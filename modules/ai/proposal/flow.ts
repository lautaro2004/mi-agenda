import type { Conversation, ProposalDraft } from "@/lib/types";
import type { AIResponse } from "@/modules/ai/types";
import { conversationRepository, type ConversationRef } from "@/modules/whatsapp/conversations/repository";
import { captureLead } from "@/modules/inquiries/capture";
import { aiLogger } from "@/modules/ai/logger";

import {
  applyMessage,
  buildLeadSummary,
  clarificationFor,
  isNo,
  isYes,
  isUsableName,
  nextField,
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

/** Arranca el flujo (o lo retoma con un borrador existente). */
export function startProposalFlow(message: string, conversation: Conversation, carry?: ProposalCarry): AIResponse {
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

  const draft = startDraft({ firstMessage: message, profileName: conversation.contactName, carry });
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
  // Última barrera: sin los datos mínimos no se registra nada.
  const missing = nextField({ ...draft, extrasAsked: true });
  if (missing === "need" || missing === "email" || missing === "name") {
    const next = { ...draft, pending: missing };
    save(ref, next);
    return reply(questionFor(missing, next));
  }

  const result = await deps.captureLead({
    businessId: conversation.businessId,
    channel: "whatsapp",
    conversationRef: conversation.id,
    name: isUsableName(draft.name) ? draft.name : conversation.contactName,
    phone: conversation.contactPhone,
    email: draft.email ?? null,
    need: draft.need ?? "",
    summary: buildLeadSummary(draft),
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
  clearProposal(ref);
  const channel = draft.email ? `a *${draft.email}*` : "por este chat";
  return reply(
    `Listo ✅ Registré tu solicitud${result.created ? "" : " (actualicé la que ya teníamos abierta)"}. El equipo la va a revisar y te va a enviar la propuesta ${channel}. Todavía no se envió ninguna propuesta; te escribimos apenas esté lista. Si querés sumar algo, escribime por acá.`
  );
}
