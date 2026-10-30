import { campaignInputSchema, canTransition, defaultFieldsForGoal, type CampaignConfig, type CampaignListItem, type CampaignStatus } from "@/lib/campaigns";
import { identifyCampaign, type IdentificationResult } from "@/modules/whatsapp/campaigns/identify";
import { prismaCampaignStore, type AttributionRow, type CampaignStore } from "@/modules/whatsapp/campaigns/store";

// Servicio de campañas de WhatsApp. El businessId SIEMPRE viene de un
// contexto de confianza (sesión del dashboard o conexión del worker).

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: string; status: 400 | 404 };

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}

export async function listCampaigns(businessId: string, store: CampaignStore = prismaCampaignStore): Promise<CampaignListItem[]> {
  const [rows, stats] = await Promise.all([store.list(businessId), store.stats(businessId)]);
  return rows.map((c) => ({ ...c, stats: stats[c.id] ?? { conversations: 0, leads: 0, qualified: 0, proposalRequests: 0 } }));
}

export async function getCampaign(businessId: string, id: string, store: CampaignStore = prismaCampaignStore) {
  return store.get(businessId, id);
}

export async function createCampaign(businessId: string, raw: unknown, store: CampaignStore = prismaCampaignStore): Promise<ServiceResult<CampaignConfig>> {
  const parsed = campaignInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), status: 400 };
  const data = parsed.data.fields.length ? parsed.data : { ...parsed.data, fields: defaultFieldsForGoal(parsed.data.goal) };
  return { ok: true, value: await store.create(businessId, data) };
}

export async function updateCampaign(businessId: string, id: string, raw: unknown, store: CampaignStore = prismaCampaignStore): Promise<ServiceResult<CampaignConfig>> {
  const current = await store.get(businessId, id);
  if (!current) return { ok: false, error: "Campaña no encontrada.", status: 404 };
  const parsed = campaignInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error), status: 400 };
  if (!canTransition(current.status, parsed.data.status)) return { ok: false, error: "Ese cambio de estado no está permitido.", status: 400 };
  const saved = await store.update(businessId, id, parsed.data);
  return saved ? { ok: true, value: saved } : { ok: false, error: "Campaña no encontrada.", status: 404 };
}

export async function setCampaignStatus(businessId: string, id: string, status: CampaignStatus, store: CampaignStore = prismaCampaignStore): Promise<ServiceResult<CampaignConfig>> {
  const current = await store.get(businessId, id);
  if (!current) return { ok: false, error: "Campaña no encontrada.", status: 404 };
  if (!canTransition(current.status, status)) return { ok: false, error: "Ese cambio de estado no está permitido.", status: 400 };
  if (status === "active" && !current.prefilledMessage && current.keywords.length === 0 && current.messageVariants.length === 0) {
    return { ok: false, error: "Para activarla, definí el mensaje precargado o al menos una expresión identificadora.", status: 400 };
  }
  const saved = await store.setStatus(businessId, id, status);
  return saved ? { ok: true, value: saved } : { ok: false, error: "Campaña no encontrada.", status: 404 };
}

/** Solo las ACTIVAS participan de nuevas conversaciones. */
export async function listActiveCampaigns(businessId: string, store: CampaignStore = prismaCampaignStore): Promise<CampaignConfig[]> {
  return (await store.list(businessId)).filter((c) => c.status === "active");
}

export interface ConversationCampaign {
  attribution: AttributionRow;
  /** Configuración vigente de la campaña (solo si sigue activa o pausada para seguir la conversación). */
  campaign: CampaignConfig | null;
  /** true si recién se evaluó en esta llamada. */
  evaluated: boolean;
  identification?: IdentificationResult;
}

/**
 * Campaña de origen de una conversación. La primera llamada evalúa el primer
 * mensaje y GUARDA el resultado (incluido "desconocido"); las siguientes
 * devuelven lo guardado sin recalcular, así un mensaje posterior —o un
 * reinicio del worker— nunca cambia el origen.
 *
 * La campaña vigente solo se entrega si NO está archivada: una campaña
 * archivada deja de intervenir (su atribución histórica se conserva).
 */
export async function resolveConversationCampaign(
  params: { businessId: string; conversationRef: string; firstMessage: string },
  store: CampaignStore = prismaCampaignStore,
): Promise<ConversationCampaign> {
  const { businessId, conversationRef, firstMessage } = params;

  const existing = await store.getAttribution(businessId, conversationRef);
  if (existing) return { attribution: existing, campaign: await currentCampaign(businessId, existing, store), evaluated: false };

  const active = await listActiveCampaigns(businessId, store);
  const identification = identifyCampaign(firstMessage, active);
  const picked = active.find((c) => c.id === identification.campaignId) ?? null;

  const created = await store.createAttribution({
    businessId,
    campaignId: picked?.id ?? null,
    campaignName: picked?.name ?? null,
    conversationRef,
    method: picked ? identification.method : "unknown",
    confidence: picked ? identification.confidence : identification.confidence,
    confirmed: false,
    firstMessage: firstMessage.replace(/\s+/g, " ").trim().slice(0, 500) || null,
  });
  const attribution = created === "exists" ? await store.getAttribution(businessId, conversationRef) : created;
  if (!attribution) throw new Error("No se pudo registrar la atribución");

  console.log(
    `[campaigns] conversación=${conversationRef} negocio=${businessId} campaña=${picked?.name ?? "-"} método=${attribution.method} confianza=${attribution.confidence} motivo=${identification.reason} candidatas=${identification.candidates.length}`,
  );
  return { attribution, campaign: picked, evaluated: created !== "exists", identification };
}

async function currentCampaign(businessId: string, attribution: AttributionRow, store: CampaignStore): Promise<CampaignConfig | null> {
  if (!attribution.campaignId) return null;
  const campaign = await store.get(businessId, attribution.campaignId);
  return campaign && campaign.status !== "archived" ? campaign : null;
}

/** Asignación manual de una conversación a una campaña (queda como confirmada). */
export async function assignCampaignManually(
  params: { businessId: string; conversationRef: string; campaignId: string | null; firstMessage?: string | null },
  store: CampaignStore = prismaCampaignStore,
): Promise<ServiceResult<AttributionRow>> {
  const { businessId, conversationRef, campaignId } = params;
  let campaign: CampaignConfig | null = null;
  if (campaignId) {
    campaign = await store.get(businessId, campaignId); // de OTRO negocio → null
    if (!campaign || campaign.status === "archived") return { ok: false, error: "Campaña no encontrada.", status: 404 };
  }
  const row = await store.upsertManualAttribution({
    businessId,
    campaignId: campaign?.id ?? null,
    campaignName: campaign?.name ?? null,
    conversationRef,
    method: campaign ? "manual" : "unknown",
    confidence: campaign ? 1 : 0,
    confirmed: !!campaign,
    firstMessage: params.firstMessage?.slice(0, 500) ?? null,
  });
  console.log(`[campaigns] asignación manual conversación=${conversationRef} negocio=${businessId} campaña=${campaign?.name ?? "-"}`);
  return { ok: true, value: row };
}

export async function getAttributions(businessId: string, conversationRefs: string[], store: CampaignStore = prismaCampaignStore) {
  return store.attributionsFor(businessId, conversationRefs);
}
