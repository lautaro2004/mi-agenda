import { CAMPAIGN_FIELD_LABEL, CAMPAIGN_GOAL_LABEL, isConfirmedAttribution, type AttributionMethod, type CampaignConfig } from "@/lib/campaigns";
import type { ProposalDraft } from "@/lib/types";

// Contexto de la campaña de origen para el modelo. Es parte del MISMO prompt
// (no hay un prompt por campaña): una sección dinámica que se agrega cuando la
// conversación viene de una campaña. El origen y la intención se mantienen
// separados: acá se describe de dónde viene la persona y qué busca la campaña;
// qué quiere hacer la persona lo sigue decidiendo el clasificador.

export interface CampaignPromptInput {
  campaign: CampaignConfig;
  method: AttributionMethod;
  /** Datos ya recopilados (no se vuelven a pedir). */
  draft?: ProposalDraft | null;
  hasBookableServices: boolean;
}

const GOAL_RULES: Record<CampaignConfig["goal"], string> = {
  lead_capture: "Tu objetivo con esta persona es conseguir sus datos de contacto para que el equipo la contacte. NO ofrezcas ni propongas horarios ni turnos.",
  proposal_request: "Tu objetivo es reunir lo necesario para que el equipo prepare una propuesta. NO ofrezcas ni propongas horarios ni turnos. Nunca digas que la propuesta ya se envió: el equipo la prepara y la envía después.",
  booking: "Tu objetivo es que la persona pueda reservar con la agenda del negocio. Solo ofrecé horarios reales cuando la persona pida reservar; el sistema valida la disponibilidad.",
  general_inquiry: "Tu objetivo es responder sus consultas con la información del negocio y orientarla, sin forzar ningún trámite.",
  human_handoff: "Tu objetivo es identificar a la persona y facilitar que alguien del equipo la atienda por este chat.",
};

function line(label: string, value: string | null | undefined): string | null {
  return value && value.trim() ? `- ${label}: ${value.trim()}` : null;
}

function collectedLines(draft: ProposalDraft | null | undefined): string[] {
  if (!draft) return [];
  const entries: Array<[string, string | undefined]> = [
    ["Nombre", draft.name],
    ["Email", draft.email],
    ["Empresa", draft.company],
    ["Necesidad", draft.need],
    ["Presupuesto", draft.budget],
    ["Plazo", draft.deadline],
    ...Object.entries(draft.extra ?? {}).map(([k, v]) => [k, v] as [string, string]),
  ];
  return entries.filter(([, v]) => !!v).map(([k, v]) => `- ${k}: ${v}`);
}

export function buildCampaignSection({ campaign, method, draft, hasBookableServices }: CampaignPromptInput): string {
  const fields = campaign.fields
    .filter((f) => f.key !== "phone")
    .map((f) => `${f.key === "custom" ? (f.label ?? CAMPAIGN_FIELD_LABEL.custom) : CAMPAIGN_FIELD_LABEL[f.key]} (${f.required ? "obligatorio" : "opcional"})`);
  const collected = collectedLines(draft);

  const origin = isConfirmedAttribution(method)
    ? "El negocio asignó esta conversación a la campaña."
    : "El origen se infirió por el texto del primer mensaje: no lo afirmes como seguro ni le menciones la campaña a la persona.";

  const parts = [
    `CAMPAÑA DE ORIGEN DE ESTA CONVERSACIÓN: «${campaign.name}»`,
    origin,
    ...[
      line("Servicio o producto promocionado", campaign.promotedService),
      line("Anuncio", campaign.adDescription),
      line("Público", campaign.targetAudience),
      line("Problema que resuelve", campaign.problemSolved),
      line("Información que debés conocer", campaign.agentKnowledge),
      line("Tono o enfoque comercial", campaign.tone),
    ].filter((l): l is string => l != null),
    `Objetivo de la campaña: ${CAMPAIGN_GOAL_LABEL[campaign.goal]}. ${GOAL_RULES[campaign.goal]}`,
    "El origen (de dónde viene la persona) no es lo que quiere hacer ahora: si cambia de tema, acompañala sin perder lo que ya contó. Pedir una reunión o un turno solo cuenta si lo pide ella.",
    campaign.secondaryGoal === "booking" && hasBookableServices
      ? "Cuando termines con el objetivo principal podés mencionar que, si quiere, también pueden coordinar una reunión; no agendes nada sin que lo pida y lo confirme."
      : null,
    fields.length ? `Datos que se buscan: ${fields.join(", ")}. El teléfono ya lo tenemos por este chat.` : null,
    collected.length ? `Datos ya recopilados (no los vuelvas a pedir):\n${collected.join("\n")}` : null,
    campaign.doNotPromise ? `NO prometas ni asumas: ${campaign.doNotPromise.trim()}` : null,
    "No inventes precios, disponibilidad ni condiciones que no estén en la información del negocio o de la campaña.",
  ].filter((l): l is string => !!l);

  return `\n${parts.join("\n")}\n`;
}
