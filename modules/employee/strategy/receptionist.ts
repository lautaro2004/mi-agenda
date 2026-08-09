import type { ConversationStrategy } from "./types";

export const receptionistStrategy: ConversationStrategy = {
  id: "receptionist",
  shapeContext(context, _conversation) {
    return { ...context, strategyId: "receptionist", emphasis: [] };
  },
};
