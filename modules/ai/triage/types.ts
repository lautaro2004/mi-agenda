import type { ConversationFlowState, MessageCategory } from "@/lib/types";
import type { ConversationIntent, InquiryTopic } from "@/modules/ai/intent/detect";

export interface ClassificationResult {
  category: MessageCategory;
  confidence: number;
  ignored: boolean;
  ignoreReason?: string;
  // Intención conversacional con la que decide el router (ver intent/route.ts).
  intent: ConversationIntent;
  topic?: InquiryTopic;
}

export interface TriageDecision {
  shouldRespond: boolean;
  classification: ClassificationResult;
  stateBefore: ConversationFlowState;
}
