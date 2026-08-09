import type { Conversation, ConversationFlowState, MessageCategory } from "@/lib/types";

import { classify } from "./classifier";
import type { TriageDecision } from "./types";

// Detects time slots in AI response text (e.g. "10:00", "16hs")
const TIME_SLOT_RE = /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*hs\b/gi;
// Detects AI asking for confirmation
const CONFIRMATION_QUESTION_RE = /confirm[aá]s|confirmar|¿(correcto|te parece|está bien)\??|¿(va|dale)\?/i;
// Detects AI confirming a booking was made
const BOOKING_CONFIRMED_RE = /reservad|confirmad|agendad|listo.*turno|turno.*listo|te esperamos/i;

export function triageMessage(message: string, conversation: Conversation): TriageDecision {
  const state = conversation.flowState;
  const recentMessages = conversation.messages.slice(-6);

  const classification = classify(message, state, recentMessages);

  return {
    shouldRespond: !classification.ignored,
    classification,
    stateBefore: state,
  };
}

export function computeNextState(
  current: ConversationFlowState,
  category: MessageCategory,
  aiResponseText: string,
): ConversationFlowState {
  // Human escalation always wins regardless of current state
  if (category === "HUMAN") return "HUMAN_HANDOFF";
  if (current === "HUMAN_HANDOFF") return "HUMAN_HANDOFF";

  switch (current) {
    case "IDLE":
    case "BOOKED":
      if (category === "APPOINTMENT") return "COLLECTING_INTENT";
      return "IDLE";

    case "COLLECTING_INTENT":
    case "OFFERING_SLOTS": {
      if (BOOKING_CONFIRMED_RE.test(aiResponseText)) return "BOOKED";
      if (CONFIRMATION_QUESTION_RE.test(aiResponseText)) return "WAITING_CONFIRMATION";
      const slots = aiResponseText.match(TIME_SLOT_RE);
      if (slots && slots.length >= 1) return "WAITING_SLOT_SELECTION";
      return "COLLECTING_INTENT";
    }

    case "WAITING_SLOT_SELECTION": {
      if (BOOKING_CONFIRMED_RE.test(aiResponseText)) return "BOOKED";
      if (CONFIRMATION_QUESTION_RE.test(aiResponseText)) return "WAITING_CONFIRMATION";
      return "WAITING_SLOT_SELECTION";
    }

    case "WAITING_CONFIRMATION": {
      if (BOOKING_CONFIRMED_RE.test(aiResponseText)) return "BOOKED";
      return "WAITING_CONFIRMATION";
    }

    default:
      return "IDLE";
  }
}
