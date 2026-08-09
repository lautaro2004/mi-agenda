import type { ConversationFlowState, ConversationMessage, MessageCategory } from "@/lib/types";

import type { ClassificationResult } from "./types";

const PATTERNS: { category: MessageCategory; re: RegExp }[] = [
  {
    category: "HUMAN",
    re: /hablar con|hablar a|person[ao]\b|human[ao]\b|dueñ[ao]|encargad[ao]|alguien de|quiero hablar|necesito hablar|operador|manager|jef[ae]|atención humana|no (quiero|bot)/i,
  },
  {
    category: "APPOINTMENT",
    re: /turno|reserv[aáo]|agendar|sacar.{0,10}turno|quiero.{0,10}(turno|cita)|pedir turno|hacer.{0,10}cita|cancel.{0,10}(turno|cita)|fecha disponible|hora disponible|cuándo (puedo|podría|podes|pueden)/i,
  },
  {
    category: "PRICING",
    re: /precio|costo|cuánto (sale|cuesta|cobran|cobras|cobra|vale|valen)|tarifa|valor|presupuest|\$|gratis|gratuito/i,
  },
  {
    category: "SCHEDULE",
    re: /horario|qué (hora|horas|días)|a qué hora|cuándo (abren|cierran|atienden|están|abre|cierra)|están abiertos|días de atención|fin de semana|abierto|cerrado|trabajan/i,
  },
  {
    category: "SERVICE",
    re: /qué (servicios|hacen|ofrecen|hacés|realizan)|qué hac[eé]|tienen (servicio|tratamiento|opción)|servicio|tratamiento/i,
  },
];

// Emoji-only: matches strings that contain only emoji, punctuation, or whitespace
const EMOJI_ONLY_RE = /^[\p{Emoji}\p{Emoji_Presentation}\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\s!.]+$/u;
// Unsupported media placeholders created by extractMessageText
const MEDIA_PLACEHOLDER_RE = /^\[.+\]$/;
// Short acknowledgements / greetings / reactions with no business content
const ACK_RE =
  /^(si|sí|no|ok|okay|dale|genial|perfecto|gracias|hola|buenas|buenos días|buenas tardes|buenas noches|re|re bien|joya|listo|np|ok gracias|de nada|👍|👋|❤️|😊|😂|✓)[\s!.]*$/i;

const SLOT_SELECTION_RE =
  /\b\d{1,2}(:\d{2})?\s*(hs|h|am|pm)?\b|el (primero|segundo|último|tercero)|la (primera|segunda|última)|primera|última opción/i;
const CONFIRMATION_RE =
  /^(si|sí|dale|ok|okay|confirmo|confirmado|listo|va|por supuesto|claro|exacto|afirmativo|sip)[\s!.]*$/i;
const CANCELLATION_RE = /^(no|cancelar|olvidá|no gracias|no quiero|cambio de idea)[\s!.]*$/i;

function detectIgnoreReason(text: string): string | null {
  if (!text.trim()) return "Mensaje vacío";
  if (MEDIA_PLACEHOLDER_RE.test(text.trim())) return "Medio no soportado";
  if (EMOJI_ONLY_RE.test(text.trim())) return "Solo emoji o reacción";
  if (ACK_RE.test(text.trim())) return "Confirmación sin flujo activo";
  return null;
}

function matchPattern(text: string): { category: MessageCategory; confidence: number } | null {
  for (const { category, re } of PATTERNS) {
    if (re.test(text)) return { category, confidence: 0.85 };
  }
  return null;
}

function lastAiMessageHasQuestion(recent: ConversationMessage[]): boolean {
  const last = [...recent].reverse().find((m) => m.sender === "ai" || m.sender === "business");
  if (!last) return false;
  return last.text.includes("?") || /cuál|qué|cómo|cuándo|dónde|querés|preferís|te va|elegís/i.test(last.text);
}

export function classify(
  message: string,
  state: ConversationFlowState,
  recentMessages: ConversationMessage[],
): ClassificationResult {
  const text = message.trim();

  // ── Active booking flow: short messages are valid responses ──────────────
  if (state === "WAITING_SLOT_SELECTION") {
    if (SLOT_SELECTION_RE.test(text)) {
      return { category: "APPOINTMENT", confidence: 0.95, ignored: false };
    }
    return { category: "APPOINTMENT", confidence: 0.75, ignored: false };
  }

  if (state === "WAITING_CONFIRMATION") {
    if (CONFIRMATION_RE.test(text) || CANCELLATION_RE.test(text)) {
      return { category: "APPOINTMENT", confidence: 0.95, ignored: false };
    }
    return { category: "APPOINTMENT", confidence: 0.7, ignored: false };
  }

  if (state === "COLLECTING_INTENT" || state === "OFFERING_SLOTS") {
    // Never ignore during active flow — try to match a category but default to APPOINTMENT
    const matched = matchPattern(text);
    if (matched) return { ...matched, ignored: false };
    return { category: "APPOINTMENT", confidence: 0.6, ignored: false };
  }

  // ── IDLE / BOOKED: full classification with ignore rules ─────────────────
  const ignoreReason = detectIgnoreReason(text);

  if (ignoreReason) {
    // Exception: if the last AI message asked a question, this short reply is contextual
    if (lastAiMessageHasQuestion(recentMessages)) {
      const matched = matchPattern(text);
      if (matched) return { ...matched, ignored: false };
      return { category: "APPOINTMENT", confidence: 0.55, ignored: false };
    }
    return { category: "IRRELEVANT", confidence: 0.9, ignored: true, ignoreReason };
  }

  const matched = matchPattern(text);
  if (matched) return { ...matched, ignored: false };

  // No pattern match and no ignore reason: let Gemini decide
  return { category: "IRRELEVANT", confidence: 0.4, ignored: false };
}
