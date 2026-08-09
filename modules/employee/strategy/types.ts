import type { Conversation } from "@/lib/types";
import type { BusinessContext } from "@/modules/ai/providers/base";

export interface StrategyContext extends BusinessContext {
  strategyId: string;
  emphasis: string[];
}

export interface ConversationStrategy {
  id: string;
  shapeContext(context: BusinessContext, conversation: Conversation | null): StrategyContext;
}
