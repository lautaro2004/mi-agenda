import { describe, expect, it } from "vitest";

import type { CampaignConfig } from "@/lib/campaigns";
import type { Conversation } from "@/lib/types";
import { decideRoute, looksLikeQuestion } from "@/modules/ai/intent/route";
import { classify } from "@/modules/ai/triage/classifier";
import { conversationRepository } from "@/modules/whatsapp/conversations/repository";

import { handleProposalFlow, startProposalFlow, type ProposalDeps } from "./flow";

let counter = 0;
function conv(contactName = "Lucas Maldonado"): Conversation {
  counter += 1;
  const c = conversationRepository.ensureConversation({ id: `${5492200000000 + counter}@s.whatsapp.net`, businessId: "biz-camp", contactName, contactPhone: "+5491155551234" });
  return c;
}

function campaign(over: Partial<CampaignConfig> = {}): CampaignConfig {
  return {
    id: "camp_web", businessId: "biz-camp", name: "Desarrollo web", description: null, status: "active", channel: "instagram",
    prefilledMessage: "Hola, quiero una web para mi negocio", messageVariants: [], keywords: [], adDescription: null,
    promotedService: "Páginas web", targetAudience: null, problemSolved: null, agentKnowledge: null, tone: null, doNotPromise: null,
    goal: "proposal_request", secondaryGoal: null,
    fields: [{ key: "need", required: true }, { key: "email", required: true }, { key: "company", required: false }, { key: "budget", required: false }],
    syncNodo: true, createOpportunity: false, initialLeadStatus: "NEW", createdAt: "", updatedAt: "",
    ...over,
  };
}

function deps() {
  const calls: Parameters<ProposalDeps["captureLead"]>[0][] = [];
  const d: ProposalDeps = { captureLead: async (i) => (calls.push(i), { ok: true, inquiryId: "inq1", created: true, nodo: "not_configured" }) };
  return { d, calls };
}

// Simula el router: clasifica, decide con el objetivo de la campaña y ejecuta.
async function say(c: Conversation, text: string, camp: CampaignConfig | null, d: ProposalDeps) {
  const cur = conversationRepository.get(c.businessId, c.id)!;
  conversationRepository.addMessage(c.businessId, c.id, { id: `m${Math.random()}`, sender: "customer", text, timestamp: new Date().toISOString() }, false);
  const now = conversationRepository.get(c.businessId, c.id)!;
  const cls = classify(text, cur.flowState, now.messages.slice(-6), { hasBookableServices: true });
  const route = decideRoute({
    flowState: cur.flowState, intent: cls.intent, isQuestion: looksLikeQuestion(text), campaignGoal: camp?.goal ?? null,
    campaignCaptured: now.campaignLeadCaptured, isFirstMessage: now.messages.filter((m) => m.sender === "customer").length <= 1, inquiryTopic: cls.topic ?? null,
  });
  if (route === "proposal_start" || route === "proposal_switch") return { route, res: startProposalFlow(text, now, undefined, { campaign: camp, hasBookableServices: true }) };
  if (route === "proposal_continue") return { route, res: await handleProposalFlow(text, now, d) };
  return { route, res: null };
}

describe("campañas: conversación", () => {
  it("7. propuesta: recopila información comercial y email, sin horarios, y registra con la campaña", async () => {
    const c = conv();
    const camp = campaign();
    const { d, calls } = deps();
    conversationRepository.setCampaign(c.businessId, c.id, { campaignId: camp.id, campaignName: camp.name, goal: camp.goal, method: "prefilled_message", confidence: 0.97, confirmed: false });

    let r = await say(c, "Hola, quiero una web para mi negocio", camp, d);
    expect(r.route).toBe("proposal_start");
    expect(r.res!.text).not.toMatch(/horario|turno|disponib/i);
    expect(r.res!.text).toMatch(/email/i); // la necesidad ya la dijo: pregunta lo que falta
    r = await say(c, "ana@resto.com", camp, d);
    expect(r.res!.text).toMatch(/opcional/i);
    r = await say(c, "listo", camp, d);
    expect(r.res!.text).toMatch(/voy a registrar/i);
    r = await say(c, "sí", camp, d);
    expect(calls).toHaveLength(1);
    expect(calls[0].campaign).toMatchObject({ id: "camp_web", name: "Desarrollo web", method: "prefilled_message", requestKind: "proposal" });
    expect(r.res!.text).toMatch(/Todavía no se envió ninguna propuesta/);
    expect(conversationRepository.get(c.businessId, c.id)!.campaignLeadCaptured).toBe(true);
  });

  it("6. captación: pide solo lo configurado, no ofrece horarios y cierra como contacto (no propuesta)", async () => {
    const c = conv();
    const camp = campaign({ name: "Captación", goal: "lead_capture", fields: [{ key: "name", required: true }, { key: "need", required: false }] });
    const { d, calls } = deps();
    let r = await say(c, "Hola, me interesa lo que ofrecen", camp, d);
    expect(r.route).toBe("proposal_start");
    // El mensaje ya alcanza (nombre del perfil + lo que le interesa): va directo a confirmar.
    expect(r.res!.text).toMatch(/voy a registrar/i);
    expect(r.res!.text).not.toMatch(/horario|turno/i);
    r = await say(c, "sí", camp, d);
    expect(calls[0].campaign).toMatchObject({ requestKind: "lead" });
    expect(r.res!.text).not.toMatch(/propuesta/i);
    expect(r.res!.text).toMatch(/comunicar/);
  });

  it("6b. si la campaña lo habilita, al final SUGIERE una reunión sin agendar nada", async () => {
    const c = conv();
    const camp = campaign({ secondaryGoal: "booking" });
    const { d, calls } = deps();
    await say(c, "Hola, quiero una web para mi negocio, mi mail es a@b.com", camp, d);
    await say(c, "listo", camp, d);
    const r = await say(c, "sí", camp, d);
    expect(r.res!.text).toMatch(/coordinar una reunión/);
    expect(calls).toHaveLength(1);
  });

  it("9. cambia de intención (pide una reunión) sin perder lo recopilado", async () => {
    const c = conv();
    const camp = campaign();
    const { d } = deps();
    await say(c, "Hola, quiero una web para mi negocio, mi mail es a@b.com", camp, d);
    const r = await say(c, "mejor quiero reservar una reunión", camp, d);
    expect(r.route).toBe("booking_switch");
    const draft = conversationRepository.get(c.businessId, c.id)!.proposalDraft;
    expect(draft).toMatchObject({ email: "a@b.com", campaignId: "camp_web" }); // sigue guardado
  });

  it("10. pide atención humana: se respeta aunque haya campaña", async () => {
    const c = conv();
    const r = await say(c, "Quiero hablar con alguien", campaign(), deps().d);
    expect(r.route).toBe("human");
  });

  it("11. no quiere dar un dato opcional: sigue; uno obligatorio se vuelve a pedir", async () => {
    const c = conv();
    const camp = campaign();
    const { d, calls } = deps();
    await say(c, "Hola, quiero una web para mi negocio", camp, d);
    let r = await say(c, "no quiero dar mi mail", camp, d);
    expect(r.res!.text).toMatch(/email/i); // obligatorio: lo sigue pidiendo
    await say(c, "ana@resto.com", camp, d);
    r = await say(c, "prefiero no decirlo", camp, d); // opcionales
    expect(r.res!.text).toMatch(/voy a registrar/i);
    r = await say(c, "sí", camp, d);
    expect(calls).toHaveLength(1);
    expect(calls[0].campaign).toBeTruthy();
  });

  it("campos configurables: rubro y ubicación obligatorios se preguntan y se guardan", async () => {
    const c = conv();
    const camp = campaign({ fields: [{ key: "need", required: true }, { key: "industry", required: true }, { key: "location", required: true }, { key: "email", required: true }] });
    const { d, calls } = deps();
    let r = await say(c, "Hola, quiero una web para mi negocio", camp, d);
    expect(r.res!.text).toMatch(/rubro/i);
    r = await say(c, "gastronomía", camp, d);
    expect(r.res!.text).toMatch(/ciudad|zona/i);
    r = await say(c, "Rosario", camp, d);
    expect(r.res!.text).toMatch(/email/i);
    await say(c, "ana@resto.com", camp, d);
    r = await say(c, "sí", camp, d);
    expect((calls[0].campaign!.data as Record<string, unknown>).industry).toBe("gastronomía");
    expect((calls[0].campaign!.data as Record<string, unknown>).location).toBe("Rosario");
  });

  it("sin campaña, el mismo mensaje no abre ningún flujo de datos", async () => {
    const c = conv();
    const r = await say(c, "Hola, quiero una web para mi negocio", null, deps().d);
    expect(r.route).toBe("standard");
  });

  it("ya registrada: otro mensaje ambiguo no reabre el flujo", async () => {
    const c = conv();
    const camp = campaign();
    const { d } = deps();
    await say(c, "Hola, quiero una web para mi negocio, mi mail es a@b.com", camp, d);
    await say(c, "listo", camp, d);
    await say(c, "sí", camp, d);
    const r = await say(c, "gracias", camp, d);
    expect(r.route).toBe("standard");
  });
});
