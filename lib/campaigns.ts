import { z } from "zod";

// Campañas de WhatsApp: constantes, tipos y validación compartidos entre el
// servidor (servicio, worker) y el dashboard. Sin dependencias de Prisma.

export const CAMPAIGN_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Borrador",
  active: "Activa",
  paused: "Pausada",
  archived: "Archivada",
};

export const CAMPAIGN_CHANNELS = ["instagram", "facebook", "other", "unknown"] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];
export const CAMPAIGN_CHANNEL_LABEL: Record<CampaignChannel, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  other: "Otro",
  unknown: "Desconocido",
};

export const CAMPAIGN_GOALS = ["lead_capture", "proposal_request", "booking", "general_inquiry", "human_handoff"] as const;
export type CampaignGoal = (typeof CAMPAIGN_GOALS)[number];
export const CAMPAIGN_GOAL_LABEL: Record<CampaignGoal, string> = {
  lead_capture: "Captar contactos",
  proposal_request: "Pedir propuesta",
  booking: "Reservar turno o reunión",
  general_inquiry: "Responder consultas",
  human_handoff: "Derivar a una persona",
};
export const CAMPAIGN_GOAL_HELP: Record<CampaignGoal, string> = {
  lead_capture: "Recopila los datos de la persona. No ofrece horarios.",
  proposal_request: "Reúne lo necesario para preparar una propuesta. No ofrece horarios.",
  booking: "Usa la agenda del negocio (servicios, horarios y disponibilidad reales).",
  general_inquiry: "Responde con la información del negocio y orienta, sin forzar un flujo.",
  human_handoff: "Toma los datos básicos y deja la conversación para una persona.",
};

// Acciones secundarias permitidas después de cumplir el objetivo.
export const CAMPAIGN_SECONDARY_GOALS = ["booking"] as const;

export const CAMPAIGN_FIELD_KEYS = [
  "name",
  "lastName",
  "email",
  "phone",
  "company",
  "industry",
  "location",
  "service",
  "need",
  "budget",
  "deadline",
  "custom",
] as const;
export type CampaignFieldKey = (typeof CAMPAIGN_FIELD_KEYS)[number];
export const CAMPAIGN_FIELD_LABEL: Record<CampaignFieldKey, string> = {
  name: "Nombre",
  lastName: "Apellido",
  email: "Email",
  phone: "Teléfono",
  company: "Empresa o negocio",
  industry: "Rubro",
  location: "Ubicación",
  service: "Servicio de interés",
  need: "Descripción de la necesidad",
  budget: "Presupuesto estimado",
  deadline: "Plazo o urgencia",
  custom: "Campo personalizado",
};

export interface CampaignField {
  key: CampaignFieldKey;
  required: boolean;
  // Solo para "custom": cómo se le pregunta al cliente.
  label?: string;
}

export const ATTRIBUTION_METHODS = ["prefilled_message", "keyword_match", "semantic_match", "manual", "unknown"] as const;
export type AttributionMethod = (typeof ATTRIBUTION_METHODS)[number];
export const ATTRIBUTION_METHOD_LABEL: Record<AttributionMethod, string> = {
  prefilled_message: "Mensaje precargado",
  keyword_match: "Coincidencia de expresiones",
  semantic_match: "Coincidencia por contexto",
  manual: "Asignada manualmente",
  unknown: "Origen desconocido",
};

/** Solo la asignación manual es "confirmada": el resto es una inferencia. */
export function isConfirmedAttribution(method: AttributionMethod): boolean {
  return method === "manual";
}

export const LEAD_INITIAL_STATUSES = ["NEW", "IN_PROGRESS"] as const;

const textList = (maxItems: number, maxLen: number) =>
  z
    .array(z.string().trim().min(2, "Muy corto").max(maxLen, "Demasiado largo"))
    .max(maxItems)
    .transform((list) => [...new Set(list.map((s) => s.trim()))]);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

export const campaignFieldSchema = z
  .object({
    key: z.enum(CAMPAIGN_FIELD_KEYS),
    required: z.boolean(),
    label: z.string().trim().max(80).optional(),
  })
  .refine((f) => f.key !== "custom" || (f.label && f.label.length >= 3), { message: "El campo personalizado necesita una pregunta", path: ["label"] });

export const campaignInputSchema = z
  .object({
    name: z.string().trim().min(3, "El nombre debe tener al menos 3 caracteres").max(80),
    description: optionalText(300),
    status: z.enum(CAMPAIGN_STATUSES).default("draft"),
    channel: z.enum(CAMPAIGN_CHANNELS).default("unknown"),
    prefilledMessage: z.string().trim().max(300).default(""),
    messageVariants: textList(10, 300).default([]),
    keywords: textList(15, 60).default([]),
    adDescription: optionalText(500),
    promotedService: optionalText(300),
    targetAudience: optionalText(300),
    problemSolved: optionalText(500),
    agentKnowledge: optionalText(1500),
    tone: optionalText(300),
    doNotPromise: optionalText(800),
    goal: z.enum(CAMPAIGN_GOALS).default("lead_capture"),
    secondaryGoal: z.enum(CAMPAIGN_SECONDARY_GOALS).nullable().optional().transform((v) => v ?? null),
    fields: z
      .array(campaignFieldSchema)
      .max(14)
      .default([])
      .refine((list) => new Set(list.map((f) => f.key)).size === list.length, { message: "Hay campos repetidos" }),
    syncNodo: z.boolean().default(true),
    createOpportunity: z.boolean().default(false),
    initialLeadStatus: z.enum(LEAD_INITIAL_STATUSES).default("NEW"),
  })
  .superRefine((value, ctx) => {
    // Para activar hace falta poder identificarla: sin mensaje ni expresiones
    // no podría asociarse a ninguna conversación.
    if (value.status === "active" && !value.prefilledMessage && value.keywords.length === 0 && value.messageVariants.length === 0) {
      ctx.addIssue({ code: "custom", path: ["prefilledMessage"], message: "Para activarla, definí el mensaje precargado o al menos una expresión identificadora" });
    }
    if (value.status === "active" && value.goal === "booking" && value.secondaryGoal) {
      ctx.addIssue({ code: "custom", path: ["secondaryGoal"], message: "Una campaña de reservas no necesita acción secundaria" });
    }
  });

export type CampaignInput = z.infer<typeof campaignInputSchema>;

/** Campos por defecto según el objetivo (ninguno es obligatorio salvo lo mínimo para contactar). */
export function defaultFieldsForGoal(goal: CampaignGoal): CampaignField[] {
  switch (goal) {
    case "proposal_request":
      return [
        { key: "need", required: true },
        { key: "email", required: true },
        { key: "name", required: false },
        { key: "company", required: false },
        { key: "budget", required: false },
        { key: "deadline", required: false },
      ];
    case "lead_capture":
      return [
        { key: "name", required: true },
        { key: "need", required: false },
        { key: "email", required: false },
      ];
    case "human_handoff":
      return [
        { key: "name", required: false },
        { key: "need", required: false },
      ];
    default:
      return [];
  }
}

export interface CampaignConfig extends Omit<CampaignInput, "status"> {
  id: string;
  businessId: string;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignStats {
  conversations: number;
  leads: number;
  qualified: number;
  proposalRequests: number;
}

export interface CampaignListItem extends CampaignConfig {
  stats: CampaignStats;
}

/** Permisos de transición: archivar siempre; reactivar archivada solo como pausada. */
export function canTransition(from: CampaignStatus, to: CampaignStatus): boolean {
  if (from === to) return true;
  if (to === "draft") return false; // un borrador no se "vuelve" borrador
  if (to === "archived") return true;
  if (from === "archived") return to === "paused";
  if (from === "draft") return to === "active" || to === "paused";
  return true; // active <-> paused
}
