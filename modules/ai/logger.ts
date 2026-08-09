import type { AILogEntry, AILogInput } from "@/modules/ai/types";

const LOG_CAPACITY = 200;

class AILogger {
  private logs: AILogEntry[] = [];

  log(entry: AILogInput) {
    const timestamped = {
      ...entry,
      timestamp: new Date().toISOString(),
    } as AILogEntry;
    this.logs.push(timestamped);
    if (this.logs.length > LOG_CAPACITY) this.logs.shift();
    console.log(`[AI] ${JSON.stringify(timestamped)}`);
  }

  recent(limit = 50): AILogEntry[] {
    return this.logs.slice(-limit);
  }

  clear() {
    this.logs = [];
  }
}

declare global {
  var __aiLogger: AILogger | undefined;
}

export const aiLogger = globalThis.__aiLogger ?? new AILogger();
globalThis.__aiLogger = aiLogger;
