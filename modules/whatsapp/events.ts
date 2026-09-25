import { EventEmitter } from "events";

import type { WhatsAppEvent } from "@/lib/types";

const EVENT_NAME = "whatsapp-event";

class WhatsAppEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  // El bus es global al proceso: todo evento lleva el negocio dueño para que
  // cada suscriptor (SSE) filtre y nunca reciba eventos de otro tenant
  // (incluye el QR de conexión y los mensajes de clientes).
  emit(businessId: string, event: WhatsAppEvent) {
    this.emitter.emit(EVENT_NAME, businessId, event);
  }

  subscribe(listener: (businessId: string, event: WhatsAppEvent) => void): () => void {
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
