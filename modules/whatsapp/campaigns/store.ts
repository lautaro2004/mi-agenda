import { prisma } from "@/lib/prisma";
import type { AttributionMethod, CampaignConfig, CampaignField, CampaignInput, CampaignStats, CampaignStatus } from "@/lib/campaigns";

// Acceso a datos de campañas. Toda consulta lleva businessId en el WHERE:
// una campaña de otro negocio nunca se puede leer ni modificar. El servicio
// (service.ts) depende de esta interfaz para poder probarse sin base.

export interface AttributionRow {
  id: string;
  businessId: string;
  campaignId: string | null;
  campaignName: string | null;
  conversationRef: string;
  method: AttributionMethod;
  confidence: number;
  confirmed: boolean;
  firstMessage: string | null;
  createdAt: string;
}

export interface NewAttribution {
  businessId: string;
  campaignId: string | null;
  campaignName: string | null;
  conversationRef: string;
  method: AttributionMethod;
  confidence: number;
  confirmed: boolean;
  firstMessage: string | null;
}

export interface CampaignStore {
  list(businessId: string): Promise<CampaignConfig[]>;
  get(businessId: string, id: string): Promise<CampaignConfig | null>;
  create(businessId: string, data: CampaignInput): Promise<CampaignConfig>;
  update(businessId: string, id: string, data: CampaignInput): Promise<CampaignConfig | null>;
  setStatus(businessId: string, id: string, status: CampaignStatus): Promise<CampaignConfig | null>;
  getAttribution(businessId: string, conversationRef: string): Promise<AttributionRow | null>;
  /** "exists" si otra ejecución ya la creó (la primera evaluación manda). */
  createAttribution(row: NewAttribution): Promise<AttributionRow | "exists">;
  /** Asignación manual: pisa la atribución previa de ESA conversación. */
  upsertManualAttribution(row: NewAttribution): Promise<AttributionRow>;
  stats(businessId: string): Promise<Record<string, CampaignStats>>;
  attributionsFor(businessId: string, conversationRefs: string[]): Promise<AttributionRow[]>;
}

type CampaignDbRow = {
  id: string; businessId: string; name: string; description: string | null; status: string; channel: string;
  prefilledMessage: string; messageVariants: string[]; keywords: string[]; adDescription: string | null;
  promotedService: string | null; targetAudience: string | null; problemSolved: string | null; agentKnowledge: string | null;
  tone: string | null; doNotPromise: string | null; goal: string; secondaryGoal: string | null; fields: unknown;
  syncNodo: boolean; createOpportunity: boolean; initialLeadStatus: string; createdAt: Date; updatedAt: Date;
};

function toConfig(row: CampaignDbRow): CampaignConfig {
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    description: row.description,
    status: row.status as CampaignConfig["status"],
    channel: row.channel as CampaignConfig["channel"],
    prefilledMessage: row.prefilledMessage,
    messageVariants: row.messageVariants,
    keywords: row.keywords,
    adDescription: row.adDescription,
    promotedService: row.promotedService,
    targetAudience: row.targetAudience,
    problemSolved: row.problemSolved,
    agentKnowledge: row.agentKnowledge,
    tone: row.tone,
    doNotPromise: row.doNotPromise,
    goal: row.goal as CampaignConfig["goal"],
    secondaryGoal: (row.secondaryGoal as CampaignConfig["secondaryGoal"]) ?? null,
    fields: Array.isArray(row.fields) ? (row.fields as CampaignField[]) : [],
    syncNodo: row.syncNodo,
    createOpportunity: row.createOpportunity,
    initialLeadStatus: row.initialLeadStatus as CampaignConfig["initialLeadStatus"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toData(data: CampaignInput) {
  return { ...data, fields: data.fields as unknown as object };
}

type AttributionDbRow = Omit<AttributionRow, "createdAt" | "method"> & { method: string; createdAt: Date };
const toAttribution = (r: AttributionDbRow): AttributionRow => ({ ...r, method: r.method as AttributionMethod, createdAt: r.createdAt.toISOString() });

export const prismaCampaignStore: CampaignStore = {
  async list(businessId) {
    const rows = await prisma.whatsappCampaign.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
    return rows.map(toConfig);
  },
  async get(businessId, id) {
    const row = await prisma.whatsappCampaign.findFirst({ where: { id, businessId } });
    return row ? toConfig(row) : null;
  },
  async create(businessId, data) {
    return toConfig(await prisma.whatsappCampaign.create({ data: { ...toData(data), businessId } }));
  },
  async update(businessId, id, data) {
    // updateMany con businessId en el WHERE: nunca toca la campaña de otro negocio.
    const res = await prisma.whatsappCampaign.updateMany({ where: { id, businessId }, data: toData(data) });
    return res.count ? this.get(businessId, id) : null;
  },
  async setStatus(businessId, id, status) {
    const res = await prisma.whatsappCampaign.updateMany({ where: { id, businessId }, data: { status } });
    return res.count ? this.get(businessId, id) : null;
  },
  async getAttribution(businessId, conversationRef) {
    const row = await prisma.whatsappCampaignAttribution.findUnique({ where: { businessId_conversationRef: { businessId, conversationRef } } });
    return row ? toAttribution(row) : null;
  },
  async createAttribution(row) {
    try {
      return toAttribution(await prisma.whatsappCampaignAttribution.create({ data: row }));
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") return "exists";
      throw error;
    }
  },
  async upsertManualAttribution(row) {
    const saved = await prisma.whatsappCampaignAttribution.upsert({
      where: { businessId_conversationRef: { businessId: row.businessId, conversationRef: row.conversationRef } },
      create: row,
      update: { campaignId: row.campaignId, campaignName: row.campaignName, method: row.method, confidence: row.confidence, confirmed: row.confirmed },
    });
    return toAttribution(saved);
  },
  async stats(businessId) {
    const [convs, leads, qualified, proposals] = await Promise.all([
      prisma.whatsappCampaignAttribution.groupBy({ by: ["campaignId"], where: { businessId, campaignId: { not: null } }, _count: { _all: true } }),
      prisma.inquiry.groupBy({ by: ["campaignId"], where: { businessId, campaignId: { not: null } }, _count: { _all: true } }),
      prisma.inquiry.groupBy({ by: ["campaignId"], where: { businessId, campaignId: { not: null }, qualificationStatus: "qualified" }, _count: { _all: true } }),
      prisma.inquiry.groupBy({ by: ["campaignId"], where: { businessId, campaignId: { not: null }, requestKind: "proposal" }, _count: { _all: true } }),
    ]);
    const out: Record<string, CampaignStats> = {};
    const slot = (id: string) => (out[id] ??= { conversations: 0, leads: 0, qualified: 0, proposalRequests: 0 });
    for (const r of convs) if (r.campaignId) slot(r.campaignId).conversations = r._count._all;
    for (const r of leads) if (r.campaignId) slot(r.campaignId).leads = r._count._all;
    for (const r of qualified) if (r.campaignId) slot(r.campaignId).qualified = r._count._all;
    for (const r of proposals) if (r.campaignId) slot(r.campaignId).proposalRequests = r._count._all;
    return out;
  },
  async attributionsFor(businessId, conversationRefs) {
    if (!conversationRefs.length) return [];
    const rows = await prisma.whatsappCampaignAttribution.findMany({ where: { businessId, conversationRef: { in: conversationRefs } } });
    return rows.map(toAttribution);
  },
};
