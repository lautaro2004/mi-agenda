import type { ConversationFlowState, ConversationMessage, MessageCategory } from "@/lib/types";
import { BOOKING_FLOW_STATES, PROPOSAL_FLOW_STATES, detectConversationIntent, type IntentResult } from "@/modules/ai/intent/detect";

import type { ClassificationResult } from "./types";

// La clasificación de contenido sale de UNA sola fuente: la detección de
// intenciones con contexto (modules/ai/intent/detect.ts). Acá solo se decide
// qué mensajes se ignoran (emojis, "ok" sin contexto) y cómo se rotula la
// categoría para el panel.

// Emoji-only: matches strings that contain only emoji, punctuation, or whitespace
export const EMOJI_ONLY_RE = /^[\p{Emoji}\p{Emoji_Presentation}\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\s!.]+$/u;
// Unsupported media placeholders created by extractMessageText
export const MEDIA_PLACEHOLDER_RE = /^\[.+\]$/;
// Short acknowledgements / greetings / reactions with no business content
export const ACK_RE =
  /^(si|sí|no|ok|okay|dale|genial|perfecto|gracias|hola|buenas|buenos días|buenas tardes|buenas noches|re|re bien|joya|listo|np|ok gracias|de nada|👍|👋|❤️|😊|😂|✓)[\s!.]*$/i;

const SLOT_SELECTION_RE =
  /\b\d{1,2}(:\d{2})?\s*(hs|h|am|pm)?\b|el (primero|segundo|último|tercero)|la (primera|segunda|última)|primera|última opción/i;
const CONFIRMATION_RE =
  /^(si|sí|dale|ok|okay|confirmo|confirmado|listo|va|por supuesto|claro|exacto|afirmativo|sip)[\s!.]*$/i;
const CANCELLATION_RE = /^(no|cancelar|olvidá|no gracias|no quiero|cambio de idea)[\s!.]*$/i;

export interface ClassifyOptions {
  hasBookableServices?: boolean;
}

function detectIgnoreReason(text: string): string | null {
  if (!text.trim()) return "Mensaje vacío";
  if (MEDIA_PLACEHOLDER_RE.test(text.trim())) return "Medio no soportado";
  if (EMOJI_ONLY_RE.test(text.trim())) return "Solo emoji o reacción";
  if (ACK_RE.test(text.trim())) return "Confirmación sin flujo activo";
  return null;
}

function lastAiMessageHasQuestion(recent: ConversationMessage[]): boolean {
  const last = [...recent].reverse().find((m) => m.sender === "ai" || m.sender === "business");
  if (!last) return false;
  return last.text.includes("?") || /cuál|qué|cómo|cuándo|dónde|querés|preferís|te va|elegís/i.test(last.text);
}

function categoryOf(detected: IntentResult): MessageCategory {
  switch (detected.intent) {
    case "booking":
      return "APPOINTMENT";
    case "proposal_request":
      return "PROPOSAL";
    case "human_handoff":
      return "HUMAN";
    case "general_inquiry":
      if (detected.topic === "pricing") return "PRICING";
      if (detected.topic === "schedule") return "SCHEDULE";
      if (detected.topic === "service") return "SERVICE";
      return "IRRELEVANT";
    default:
      return "IRRELEVANT";
  }
}

export function classify(
  message: string,
  state: ConversationFlowState,
  recentMessages: ConversationMessage[],
  options: ClassifyOptions = {},
): ClassificationResult {
  const text = message.trim();
  const detected = detectConversationIntent({
    message: text,
    flowState: state,
    recentMessages: recentMessages.map((m) => ({ sender: m.sender, text: m.text })),
    hasBookableServices: options.hasBookableServices,
  });
  const base = { intent: detected.intent, topic: detected.topic };

  // Pedir atención humana se respeta en cualquier estado.
  if (detected.intent === "human_handoff") {
    return { category: "HUMAN", confidence: detected.confidence, ignored: false, ...base };
  }

  // ── Solicitud de propuesta en curso: nunca se ignora ─────────────────────
  if (PROPOSAL_FLOW_STATES.has(state)) {
    if (detected.intent === "booking") return { category: "APPOINTMENT", confidence: 0.85, ignored: false, ...base };
    return { category: "PROPOSAL", confidence: detected.intent === "proposal_request" ? 0.95 : 0.8, ignored: false, ...base };
  }

  // ── Reserva en curso: las respuestas cortas son válidas ──────────────────
  if (BOOKING_FLOW_STATES.has(state)) {
    // El cliente cambió de objetivo (ej. pide una propuesta por mail).
    if (detected.intent === "proposal_request") return { category: "PROPOSAL", confidence: 0.85, ignored: false, ...base };

    if (state === "WAITING_SLOT_SELECTION") {
      return { category: "APPOINTMENT", confidence: SLOT_SELECTION_RE.test(text) ? 0.95 : 0.75, ignored: false, ...base };
    }
    if (state === "WAITING_CONFIRMATION") {
      const answered = CONFIRMATION_RE.test(text) || CANCELLATION_RE.test(text);
      return { category: "APPOINTMENT", confidence: answered ? 0.95 : 0.7, ignored: false, ...base };
    }
    // COLLECTING_INTENT / OFFERING_SLOTS / WAITING_PAYMENT_PROOF
    const category = categoryOf(detected);
    const keep = category === "PRICING" || category === "SERVICE" || category === "SCHEDULE";
    return { category: keep ? category : "APPOINTMENT", confidence: keep ? detected.confidence : 0.6, ignored: false, ...base };
  }

  // ── IDLE / BOOKED ─────────────────────────────────────────────────────────
  const ignoreReason = detectIgnoreReason(text);
  if (ignoreReason) {
    // Un "sí" que acepta lo que el asistente ofreció (propuesta o reserva).
    if (detected.intent === "proposal_request" || detected.intent === "booking") {
      return { category: categoryOf(detected), confidence: detected.confidence, ignored: false, ...base };
    }
    // Responde a una pregunta del asistente: se deja que el modelo lo
    // resuelva con el historial. Antes se asumía una reserva.
    if (lastAiMessageHasQuestion(recentMessages)) {
      return { category: "IRRELEVANT", confidence: 0.5, ignored: false, ...base };
    }
    return { category: "IRRELEVANT", confidence: 0.9, ignored: true, ignoreReason, ...base };
  }

  return { category: categoryOf(detected), confidence: Math.min(detected.confidence, 0.9), ignored: false, ...base };
}
