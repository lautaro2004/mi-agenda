import type { ConversationFlowState } from "@/lib/types";
import type { CampaignGoal } from "@/lib/campaigns";

import { PROPOSAL_FLOW_STATES, type ConversationIntent } from "./detect";

// Decide QUÉ flujo atiende el mensaje a partir de la intención detectada, el
// estado de la conversación y —si la hay— el objetivo de la campaña de
// origen. Es una función pura (sin efectos): todas las transiciones entre
// flujos —incluida la salida segura de una reserva— se definen y se prueban
// acá, no dispersas en el router.
export type Route =
  | "human"
  | "proposal_start"
  | "proposal_switch" // sale de una reserva y arranca la propuesta
  | "proposal_continue"
  | "booking_start"
  | "booking_switch" // sale de una propuesta y arranca la reserva
  | "booking_continue"
  | "booking_interruptible" // reserva activa que admite una pregunta puntual
  | "answer_keep" // responde una pregunta SIN cambiar el flujo en curso
  | "standard";

// Pregunta explícita (no un dato que casualmente nombra "precios"): evita
// tratar como consulta general la descripción de un proyecto.
export function looksLikeQuestion(message: string): boolean {
  const text = message.trim();
  return (
    /\?\s*$/.test(text) ||
    text.startsWith("¿") ||
    /^(qué|que|cómo|como|cuándo|cuando|cuánto|cuanto|cuántos|dónde|donde|cuál|cual|cuáles|quién|quien|por qué)\b/i.test(text)
  );
}

export interface RouteInput {
  flowState: ConversationFlowState;
  intent: ConversationIntent;
  isQuestion: boolean;
  /** Objetivo de la campaña de origen (null/undefined: sin campaña). */
  campaignGoal?: CampaignGoal | null;
  /** La campaña ya recopiló los datos de esta persona: no se vuelve a abrir el flujo. */
  campaignCaptured?: boolean;
  /** Es el primer mensaje de la persona en la conversación. */
  isFirstMessage?: boolean;
  /** Tema de la consulta general (precios, horarios…): esas se responden, no abren un flujo. */
  inquiryTopic?: string | null;
}

// Objetivos cuyo flujo propio es recopilar datos (nunca ofrecer horarios).
const COLLECTING_GOALS = new Set<CampaignGoal>(["lead_capture", "proposal_request", "human_handoff"]);

export function decideRoute({ flowState, intent, isQuestion, campaignGoal, campaignCaptured, isFirstMessage, inquiryTopic }: RouteInput): Route {
  if (intent === "human_handoff") return "human";

  if (PROPOSAL_FLOW_STATES.has(flowState)) {
    if (intent === "booking") return "booking_switch";
    if (intent === "general_inquiry" && isQuestion) return "answer_keep";
    return "proposal_continue";
  }

  // Con un comprobante pendiente no se desvía la conversación.
  if (flowState === "WAITING_PAYMENT_PROOF") return "booking_continue";

  if (flowState === "WAITING_SLOT_SELECTION" || flowState === "WAITING_CONFIRMATION") {
    if (intent === "proposal_request") return "proposal_switch";
    if (intent === "general_inquiry" && isQuestion) return "answer_keep";
    return "booking_continue";
  }

  if (flowState === "COLLECTING_INTENT" || flowState === "OFFERING_SLOTS") {
    if (intent === "proposal_request") return "proposal_switch";
    if (intent === "general_inquiry") return "booking_interruptible";
    return "booking_continue";
  }

  // Sin flujo activo: solo se inicia lo que el cliente pidió…
  if (intent === "booking") return "booking_start";
  if (intent === "proposal_request") return "proposal_start";

  // …salvo que la campaña de origen tenga como objetivo recopilar datos: el
  // primer mensaje descriptivo ("quiero una página web para mi negocio") abre
  // directamente ese flujo, sin reservas. Una pregunta se responde; un
  // mensaje posterior ambiguo ("ok", "gracias") no reabre nada.
  const answersOwnTopic = intent === "general_inquiry" && !!inquiryTopic && inquiryTopic !== "service";
  if (campaignGoal && COLLECTING_GOALS.has(campaignGoal) && !campaignCaptured && isFirstMessage && !isQuestion && !answersOwnTopic) {
    return "proposal_start";
  }
  return "standard";
}
