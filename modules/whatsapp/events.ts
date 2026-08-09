import { EventEmitter } from "events";

import type { WhatsAppEvent } from "@/lib/types";

const EVENT_NAME = "whatsapp-event";

class WhatsAppEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit(event: WhatsAppEvent) {
    this.emitter.emit(EVENT_NAME, event);
  }

  subscribe(listener: (event: WhatsAppEvent) => void): () => void {
    this.emitter.on(EVENT_NAME, listener);
    return () => {
      this.emitter.off(EVENT_NAME, listener);
    };
  }
}

declare global {
  var __whatsappEventBus: WhatsAppEventBus | undefined;
}

export const whatsappEvents = globalThis.__whatsappEventBus ?? new WhatsAppEventBus();
globalThis.__whatsappEventBus = whatsappEvents;
