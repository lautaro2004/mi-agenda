import { defaultFieldsForGoal, type CampaignConfig } from "@/lib/campaigns";
import type { Conversation, ProposalDraft, ProposalPlan } from "@/lib/types";
import type { AIResponse } from "@/modules/ai/types";
import { conversationRepository, type ConversationRef } from "@/modules/whatsapp/conversations/repository";
import { captureLead } from "@/modules/inquiries/capture";
import { aiLogger } from "@/modules/ai/logger";

import {
  applyMessage,
  buildLeadSummary,
  DEFAULT_PLAN,
  clarificationFor,
  fullName,
  isNo,
  isYes,
  isUsableName,
  nextField,
  planFromFields,
  questionFor,
  startDraft,
} from "./draft";

// Flujo conversacional de SOLICITUD DE PROPUESTA (presupuesto comercial).
// Recopila de a poco lo que falta, pide confirmación y recién entonces
// registra el interesado (nexo.Inquiry, canal WhatsApp) — el mismo registro
// que usa el resto del sistema, sin duplicar tablas. Nunca dice que se envió
// una propuesta: solo que el equipo la va a revisar.

function reply(text: string, extra: Partial<AIResponse> = {}): AIResponse {
  return { text, intent: "proposal", source: "rule", escalateToHuman: false, labelHint: "pricing", ...extra };
}

function save(ref: ConversationRef, draft: ProposalDraft) {
  conversationRepository.setProposalDraft(ref.businessId, ref.id, draft);
  conversationRepository.setFlowState(ref.businessId, ref.id, draft.pending === "confirm" ? "WAITING_PROPOSAL_CONFIRMATION" : "COLLECTING_PROPOSAL");
}

export function clearProposal(ref: ConversationRef) {
  conversationRepository.clearProposalDraft(ref.businessId, ref.id);
  conversationRepository.setFlowState(ref.businessId, ref.id, "IDLE");
}

export interface ProposalCarry {
  service?: string | null;
  name?: string | null;
  email?: string | null;
  need?: string | null;
}

export interface ProposalStartOptions {
  /** Campaña de origen vigente (define qué datos pedir y cómo cerrar). */
  campaign?: CampaignConfig | null;
  /** Hay servicios reservables: habilita sugerir una reunión al final. */
  hasBookableServices?: boolean;
}

const GOAL_KIND = { proposal_request: "proposal", lead_capture: "lead", human_handoff: "handoff" } as const;

/** Plan de preguntas de la campaña (o el de siempre si no hay campaña). */
export function planForCampaign(campaign: CampaignConfig | null | undefined, hasBookableServices = false): ProposalPlan | undefined {
  if (!campaign) return undefined;
  const goal = GOAL_KIND[campaign.goal as keyof typeof GOAL_KIND] ?? "proposal";
  const fields = campaign.fields.length ? campaign.fields : defaultFieldsForGoal(campaign.goal);
  const base = fields.length ? planFromFields(fields) : { required: DEFAULT_PLAN.required, optional: DEFAULT_PLAN.optional };
  return {
    ...base,
    goal,
    offerMeeting: campaign.secondaryGoal === "booking" && hasBookableServices,
    syncNodo: campaign.syncNodo,
    initialStatus: campaign.initialLeadStatus,
  };
}

/** Arranca el flujo (o lo retoma con un borrador existente). */
export function startProposalFlow(message: string, conversation: Conversation, carry?: ProposalCarry, options: ProposalStartOptions = {}): AIResponse {
  const ref: ConversationRef = { businessId: conversation.businessId, id: conversation.id };

  // Un borrador anterior (el cliente lo había dejado a medias) se retoma:
  // lo ya dicho no se vuelve a preguntar.
  if (conversation.proposalDraft) {
    const resumed = applyMessage({ ...conversation.proposalDraft, pending: nextField(conversation.proposalDraft) }, message, {
      phoneAvailable: !!conversation.contactPhone,
    });
    const draft = { ...resumed.draft, pending: nextField(resumed.draft) };
    save(ref, draft);
    return reply(`Retomo tu solicitud de propuesta. ${questionFor(draft.pending, draft)}`);
  }

  const draft = startDraft({
    firstMessage: message,
    profileName: conversation.contactName,
    carry,
    plan: planForCampaign(options.campaign, options.hasBookableServices),
    campaign: options.campaign ? { id: options.campaign.id, name: options.campaign.name } : undefined,
  });
  save(ref, draft);
  return reply(questionFor(draft.pending, draft, { first: true }));
}

// Dependencias con efectos reales, inyectables para probar el flujo sin base.
export interface ProposalDeps {
  captureLead: typeof captureLead;
}
const defaultDeps: ProposalDeps = { captureLead };

export async function handleProposalFlow(message: string, conversation: Conversation, deps: ProposalDeps = defaultDeps): Promise<AIResponse> {
  const ref: ConversationRef = { businessId: conversation.businessId, id: conversation.id };
  const draft = conversation.proposalDraft;
  if (!draft) return startProposalFlow(message, conversation);

  // ── Esperando "¿está bien?" ────────────────────────────────────────────
  if (draft.pending === "confirm" && conversation.flowState === "WAITING_PROPOSAL_CONFIRMATION") {
    if (isYes(message)) return finalize(ref, conversation, draft, deps);

    const turn = applyMessage(draft, message, { phoneAvailable: !!conversation.contactPhone });
    if (turn.changed) {
      save(ref, { ...turn.draft, pending: "confirm" });
      return reply(`Listo, lo actualicé.\n\n${questionFor("confirm", turn.draft)}`);
    }
    if (isNo(message)) {
      save(ref, { ...draft, pending: "edit" });
      return reply(questionFor("edit", draft));
    }
    save(ref, draft);
    return reply(`${questionFor("confirm", draft)}`);
  }

  // ── Recopilando datos ──────────────────────────────────────────────────
  const turn = applyMessage(draft, message, { phoneAvailable: !!conversation.contactPhone });
  if (turn.unclear && !turn.changed) {
    save(ref, draft);
    return reply(clarificationFor(draft.pending));
  }
  save(ref, turn.draft);
  return reply(questionFor(turn.draft.pending, turn.draft));
}

async function finalize(ref: ConversationRef, conversation: Conversation, draft: ProposalDraft, deps: ProposalDeps): Promise<AIResponse> {
  // Última barrera: sin los datos obligatorios no se registra nada.
  const missing = nextField({ ...draft, extrasAsked: true });
  if (missing !== "confirm") {
    const next = { ...draft, pending: missing };
    save(ref, next);
    return reply(questionFor(missing, next));
  }

  const plan = draft.plan;
  const goal = plan?.goal ?? "proposal";
  const requestKind = goal === "lead" ? "lead" : goal === "handoff" ? "handoff" : "proposal";
  const name = fullName(draft);
  // Si la campaña no pidió nombre/necesidad, se usa lo que ya hay (perfil de
  // WhatsApp, nombre de la campaña): captureLead exige ambos.
  const leadName = isUsableName(name) ? name! : isUsableName(conversation.contactName) ? conversation.contactName : "Contacto de WhatsApp";
  const leadNeed = draft.need || draft.extra?.service || (draft.campaignName ? `Consulta desde la campaña «${draft.campaignName}»` : "");

  const result = await deps.captureLead({
    businessId: conversation.businessId,
    channel: "whatsapp",
    conversationRef: conversation.id,
    name: leadName,
    phone: conversation.contactPhone,
    email: draft.email ?? null,
    need: leadNeed,
    summary: buildLeadSummary(draft),
    ...(draft.campaignId && draft.campaignName
      ? {
          campaign: {
            id: draft.campaignId,
            name: draft.campaignName,
            method: conversation.campaign?.method ?? "unknown",
            requestKind,
            data: collectedData(draft),
            syncNodo: plan?.syncNodo,
            initialStatus: plan?.initialStatus,
          },
        }
      : {}),
  });

  if (!result.ok) {
    aiLogger.log({ type: "action_executed", conversationId: conversation.id, action: "register_lead", ok: false });
    if (result.reason === "invalid") {
      // Falta algo que el sistema exige (ej. un contacto): se pide, no se simula.
      const next = { ...draft, pending: "email" as const };
      save(ref, next);
      return reply("Todavía me falta un dato de contacto para registrar tu solicitud. ¿A qué email puede escribirte el equipo?");
    }
    // Falla técnica: NO se dice que quedó registrado; el borrador se conserva
    // y se deriva a una persona.
    save(ref, draft);
    return reply(
      "Tuve un problema técnico y tu solicitud todavía NO quedó registrada. Le aviso a una persona del equipo para que la tome por este chat.",
      { escalateToHuman: true, labelHint: "human_required" }
    );
  }

  aiLogger.log({ type: "action_executed", conversationId: conversation.id, action: "register_lead", ok: true });
  if (draft.campaignId) conversationRepository.markCampaignLeadCaptured(ref.businessId, ref.id);
  clearProposal(ref);

  const updated = result.created ? "" : " (actualicé la que ya teníamos abierta)";
  const channel = draft.email ? `a *${draft.email}*` : "por este chat";
  const meeting = plan?.offerMeeting ? " Si además querés coordinar una reunión, avisame y vemos los horarios disponibles." : "";

  if (goal === "handoff") {
    return reply(`Listo ✅ Registré tus datos${updated}. Dejo la conversación para que una persona del equipo siga con vos por este chat.`, {
      escalateToHuman: true,
      labelHint: "human_required",
    });
  }
  if (goal === "lead") {
    return reply(`Listo ✅ Registré tus datos${updated}. El equipo va a revisar tu consulta y se va a comunicar con vos ${channel}.${meeting}`);
  }
  return reply(
    `Listo ✅ Registré tu solicitud${updated}. El equipo la va a revisar y te va a enviar la propuesta ${channel}. Todavía no se envió ninguna propuesta; te escribimos apenas esté lista. Si querés sumar algo, escribime por acá.${meeting}`
  );
}

// Datos recopilados, para guardar estructurados junto al interesado.
function collectedData(draft: ProposalDraft): Record<string, unknown> {
  return {
    goal: draft.plan?.goal ?? "proposal",
    name: fullName(draft) ?? null,
    email: draft.email ?? null,
    company: draft.company ?? null,
    need: draft.need ?? null,
    budget: draft.budget ?? null,
    deadline: draft.deadline ?? null,
    details: draft.details ?? null,
    ...(draft.extra ?? {}),
  };
}
