import type { BusinessContext } from "@/modules/ai/providers/base";
import { receptionistStrategy } from "./receptionist";
import type { ConversationStrategy } from "./types";

export function resolveStrategy(_context: BusinessContext): ConversationStrategy {
  return receptionistStrategy;
}
