import type { ConversationFlowState, MessageCategory } from "@/lib/types";

export type MessageIntent =
  | "pricing"
  | "schedule"
  | "location"
  | "service"
  | "appointment"
  | "human"
  | "other";

export type AIResponseSource = "rule" | "gemini" | "escalation";

export interface AIResponse {
  text: string;
  intent: MessageIntent;
  source: AIResponseSource;
  escalateToHuman: boolean;
  labelHint?: "appointment_request" | "human_required" | "pricing" | "service_inquiry";
}

export type AILogEntry =
  | {
      type: "intent_detected";
      conversationId: string;
      intent: MessageIntent;
      preview: string;
      timestamp: string;
    }
  | {
      type: "rule_match";
      conversationId: string;
      intent: MessageIntent;
      rule: string;
      timestamp: string;
    }
  | {
      type: "gemini_usage";
      conversationId: string;
      model: string;
      timestamp: string;
    }
  | {
      type: "response_generated";
      conversationId: string;
      source: AIResponseSource;
      escalate: boolean;
      timestamp: string;
    }
  | {
      type: "triage";
      conversationId: string;
      category: MessageCategory;
      confidence: number;
      stateBefore: ConversationFlowState;
      stateAfter: ConversationFlowState;
      action: "responded" | "ignored" | "escalated";
      ignoreReason?: string;
      timestamp: string;
    };

// Distributive Omit — needed because Omit<UnionType, K> collapses the union
export type AILogInput = AILogEntry extends infer U
  ? U extends { timestamp: string }
    ? Omit<U, "timestamp">
    : never
  : never;
