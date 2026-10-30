import { describe, expect, it } from "vitest";

import type { CampaignConfig, CampaignInput, CampaignStats } from "@/lib/campaigns";
import type { AttributionRow, CampaignStore, NewAttribution } from "./store";
import { assignCampaignManually, createCampaign, listActiveCampaigns, listCampaigns, resolveConversationCampaign, setCampaignStatus, updateCampaign } from "./service";

// Store en memoria que respeta el mismo contrato que el de Prisma: TODO se
// filtra por businessId.
function fakeStore(): CampaignStore & { campaigns: CampaignConfig[]; attributions: AttributionRow[] } {
  let n = 0;
  const campaigns: CampaignConfig[] = [];
  const attributions: AttributionRow[] = [];
  const now = () => new Date().toISOString();
  const attr = (r: NewAttribution): AttributionRow => ({ ...r, id: `a${++n}`, createdAt: now() });
  return {
    campaigns,
    attributions,
    async list(b) { return campaigns.filter((c) => c.businessId === b); },
    async get(b, id) { return campaigns.find((c) => c.id === id && c.businessId === b) ?? null; },
    async create(b, data: CampaignInput) {
      const c: CampaignConfig = { ...data, id: `c${++n}`, businessId: b, createdAt: now(), updatedAt: now() };
      campaigns.push(c);
      return c;
    },
    async update(b, id, data) {
      const i = campaigns.findIndex((c) => c.id === id && c.businessId === b);
      if (i < 0) return null;
      campaigns[i] = { ...campaigns[i], ...data, updatedAt: now() };
      return campaigns[i];
    },
    async setStatus(b, id, status) {
      const c = campaigns.find((x) => x.id === id && x.businessId === b);
      if (!c) return null;
      c.status = status;
      return c;
    },
    async getAttribution(b, ref) { return attributions.find((a) => a.businessId === b && a.conversationRef === ref) ?? null; },
    async createAttribution(r) {
      if (attributions.some((a) => a.businessId === r.businessId && a.conversationRef === r.conversationRef)) return "exists";
      const a = attr(r);
      attributions.push(a);
      return a;
    },
    async upsertManualAttribution(r) {
      const i = attributions.findIndex((a) => a.businessId === r.businessId && a.conversationRef === r.conversationRef);
      const a = { ...attr(r), id: i >= 0 ? attributions[i].id : `a${n}` };
      if (i >= 0) attributions[i] = a; else attributions.push(a);
      return a;
    },
    async stats(b) {
      const out: Record<string, CampaignStats> = {};
      for (const a of attributions) if (a.businessId === b && a.campaignId) (out[a.campaignId] ??= { conversations: 0, leads: 0, qualified: 0, proposalRequests: 0 }).conversations++;
      return out;
    },
    async attributionsFor(b, refs) { return attributions.filter((a) => a.businessId === b && refs.includes(a.conversationRef)); },
  };
}

const WEB = {
  name: "Desarrollo web",
  status: "active",
  goal: "proposal_request",
  prefilledMessage: "Hola, vi el anuncio de Kodexa y quiero una web para mi negocio",
};

async function make(store: ReturnType<typeof fakeStore>, business: string, over: Record<string, unknown> = {}) {
  const res = await createCampaign(business, { ...WEB, ...over }, store);
  if (!res.ok) throw new Error(res.error);
  return res.value;
}

describe("campañas: validación y estados", () => {
  it("crea con campos por defecto según el objetivo y ninguno obligatorio de más", async () => {
    const store = fakeStore();
    const c = await make(store, "b1");
    expect(c.fields.map((f) => f.key)).toEqual(["need", "email", "name", "company", "budget", "deadline"]);
    expect(c.fields.filter((f) => f.required).map((f) => f.key)).toEqual(["need", "email"]);
  });

  it("rechaza activar sin forma de identificarla y nombres cortos", async () => {
    const store = fakeStore();
    const noId = await createCampaign("b1", { name: "Sin mensaje", status: "active", goal: "lead_capture" }, store);
    expect(noId.ok).toBe(false);
    const short = await createCampaign("b1", { name: "ab", prefilledMessage: "hola quiero algo concreto" }, store);
    expect(short.ok).toBe(false);
    const draft = await createCampaign("b1", { name: "Borrador", goal: "lead_capture" }, store);
    expect(draft.ok).toBe(true);
  });

  it("campo personalizado exige la pregunta y no admite campos repetidos", async () => {
    const store = fakeStore();
    expect((await createCampaign("b1", { ...WEB, fields: [{ key: "custom", required: false }] }, store)).ok).toBe(false);
    expect((await createCampaign("b1", { ...WEB, fields: [{ key: "email", required: true }, { key: "email", required: false }] }, store)).ok).toBe(false);
  });

  it("pausa, archiva y no deja volver a activar una archivada directamente", async () => {
    const store = fakeStore();
    const c = await make(store, "b1");
    expect((await setCampaignStatus("b1", c.id, "paused", store)).ok).toBe(true);
    expect((await setCampaignStatus("b1", c.id, "archived", store)).ok).toBe(true);
    expect((await setCampaignStatus("b1", c.id, "active", store)).ok).toBe(false);
    expect((await setCampaignStatus("b1", c.id, "paused", store)).ok).toBe(true);
  });

  it("una campaña inactiva (pausada, archivada, borrador) no participa de conversaciones nuevas", async () => {
    const store = fakeStore();
    const a = await make(store, "b1");
    await make(store, "b1", { name: "Borrador", status: "draft", prefilledMessage: "Hola, quiero otra cosa distinta ahora" });
    await setCampaignStatus("b1", a.id, "paused", store);
    expect(await listActiveCampaigns("b1", store)).toHaveLength(0);
    const r = await resolveConversationCampaign({ businessId: "b1", conversationRef: "x@s", firstMessage: WEB.prefilledMessage }, store);
    expect(r.attribution.campaignId).toBeNull();
    expect(r.attribution.method).toBe("unknown");
  });
});

describe("atribución de la conversación", () => {
  it("1/14. mensaje precargado: asocia conversación y campaña, como inferida (no confirmada)", async () => {
    const store = fakeStore();
    const c = await make(store, "b1");
    const r = await resolveConversationCampaign({ businessId: "b1", conversationRef: "111@s", firstMessage: WEB.prefilledMessage }, store);
    expect(r.evaluated).toBe(true);
    expect(r.campaign?.id).toBe(c.id);
    expect(r.attribution).toMatchObject({ campaignId: c.id, campaignName: "Desarrollo web", method: "prefilled_message", confirmed: false });
  });

  it("5. un mensaje posterior distinto NO cambia la campaña (ni se recalcula)", async () => {
    const store = fakeStore();
    const c = await make(store, "b1");
    const other = await make(store, "b1", { name: "Automatización", prefilledMessage: "Hola, quiero automatizar tareas de mi negocio" });
    await resolveConversationCampaign({ businessId: "b1", conversationRef: "111@s", firstMessage: WEB.prefilledMessage }, store);
    const second = await resolveConversationCampaign({ businessId: "b1", conversationRef: "111@s", firstMessage: other.prefilledMessage }, store);
    expect(second.evaluated).toBe(false);
    expect(second.attribution.campaignId).toBe(c.id);
    expect(store.attributions).toHaveLength(1);
  });

  it("3. mensaje genérico: queda registrado como desconocido y no se reatribuye después", async () => {
    const store = fakeStore();
    await make(store, "b1");
    const first = await resolveConversationCampaign({ businessId: "b1", conversationRef: "222@s", firstMessage: "Hola" }, store);
    expect(first.attribution.method).toBe("unknown");
    const later = await resolveConversationCampaign({ businessId: "b1", conversationRef: "222@s", firstMessage: WEB.prefilledMessage }, store);
    expect(later.attribution.campaignId).toBeNull();
  });

  it("la edición o el archivado de la campaña conservan la atribución histórica", async () => {
    const store = fakeStore();
    const c = await make(store, "b1");
    await resolveConversationCampaign({ businessId: "b1", conversationRef: "111@s", firstMessage: WEB.prefilledMessage }, store);
    await updateCampaign("b1", c.id, { ...WEB, name: "Renombrada", status: "active" }, store);
    await setCampaignStatus("b1", c.id, "archived", store);
    const r = await resolveConversationCampaign({ businessId: "b1", conversationRef: "111@s", firstMessage: "otro texto" }, store);
    expect(r.attribution).toMatchObject({ campaignId: c.id, campaignName: "Desarrollo web" }); // snapshot original
    expect(r.campaign).toBeNull(); // archivada: ya no interviene
  });

  it("asignación manual queda confirmada y pisa solo esa conversación", async () => {
    const store = fakeStore();
    const c = await make(store, "b1");
    await resolveConversationCampaign({ businessId: "b1", conversationRef: "333@s", firstMessage: "Hola" }, store);
    const res = await assignCampaignManually({ businessId: "b1", conversationRef: "333@s", campaignId: c.id }, store);
    expect(res.ok && res.value).toMatchObject({ campaignId: c.id, method: "manual", confirmed: true });
    expect(store.attributions).toHaveLength(1);
  });
});

describe("multi-tenancy", () => {
  it("18. un negocio no ve, edita, pausa, asigna ni usa campañas de otro", async () => {
    const store = fakeStore();
    const mine = await make(store, "b1");
    expect(await listCampaigns("b2", store)).toHaveLength(0);
    expect((await updateCampaign("b2", mine.id, { ...WEB, name: "Hackeada" }, store)).ok).toBe(false);
    expect((await setCampaignStatus("b2", mine.id, "archived", store)).ok).toBe(false);
    expect((await assignCampaignManually({ businessId: "b2", conversationRef: "9@s", campaignId: mine.id }, store)).ok).toBe(false);
    // El mensaje de b1 entrando por el WhatsApp de b2 no activa campañas de b1.
    const r = await resolveConversationCampaign({ businessId: "b2", conversationRef: "9@s", firstMessage: WEB.prefilledMessage }, store);
    expect(r.attribution.campaignId).toBeNull();
    expect(store.campaigns.find((c) => c.id === mine.id)?.name).toBe("Desarrollo web");
    expect(store.campaigns.find((c) => c.id === mine.id)?.status).toBe("active");
  });

  it("la misma conversación de dos negocios tiene atribuciones independientes", async () => {
    const store = fakeStore();
    const a = await make(store, "b1");
    await make(store, "b2", { name: "Otra", prefilledMessage: "Hola, quiero automatizar tareas de mi negocio" });
    const r1 = await resolveConversationCampaign({ businessId: "b1", conversationRef: "same@s", firstMessage: WEB.prefilledMessage }, store);
    const r2 = await resolveConversationCampaign({ businessId: "b2", conversationRef: "same@s", firstMessage: WEB.prefilledMessage }, store);
    expect(r1.attribution.campaignId).toBe(a.id);
    expect(r2.attribution.campaignId).toBeNull();
  });
});
