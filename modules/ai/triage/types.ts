import type { ConversationFlowState, MessageCategory } from "@/lib/types";

export interface ClassificationResult {
  category: MessageCategory;
  confidence: number;
  ignored: boolean;
  ignoreReason?: string;
}

export interface TriageDecision {
  shouldRespond: boolean;
  classification: ClassificationResult;
  stateBefore: ConversationFlowState;
}
