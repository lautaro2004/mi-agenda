import type {
  BookingSession,
  Conversation,
  ConversationFlowState,
  ConversationLabel,
  ConversationMessage,
  ConversationStatus,
  ConversationTriage,
} from "@/lib/types";
import { whatsappEvents } from "@/modules/whatsapp/events";

// Las conversaciones se indexan por negocio + JID, nunca por JID solo: dos
// negocios que hablan con el mismo número de WhatsApp tienen conversaciones
// completamente independientes. El businessId siempre viene de un contexto de
// confianza (sesión del dashboard o conexión de WhatsApp del negocio), jamás
// de un valor enviado por el cliente.
export interface ConversationRef {
  businessId: string;
  id: string;
}

function keyOf(businessId: string, id: string): string {
  return `${businessId}:${id}`;
}

class ConversationRepository {
  private conversations = new Map<string, Conversation>();

  list(businessId: string): Conversation[] {
    return [...this.conversations.values()]
      .filter((c) => c.businessId === businessId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  get(businessId: string, id: string): Conversation | undefined {
    return this.conversations.get(keyOf(businessId, id));
  }

  clear() {
    this.conversations.clear();
  }

  private save(conversation: Conversation) {
    this.conversations.set(keyOf(conversation.businessId, conversation.id), conversation);
    whatsappEvents.emit(conversation.businessId, { type: "conversation", payload: conversation });
    return conversation;
  }

  ensureConversation(params: {
    id: string;
    businessId: string;
    contactName: string;
    contactPhone: string;
  }): Conversation {
    const existing = this.conversations.get(keyOf(params.businessId, params.id));
    if (existing) return existing;

    const conversation: Conversation = {
      id: params.id,
      businessId: params.businessId,
      contactName: params.contactName,
      contactPhone: params.contactPhone,
      labels: [],
      status: "open",
      manualMode: false,
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
      messages: [],
      flowState: "IDLE",
    };
    return this.save(conversation);
  }

  importConversation(params: {
    id: string;
    businessId: string;
    contactName: string;
    contactPhone: string;
  }): Conversation {
    const existing = this.conversations.get(keyOf(params.businessId, params.id));
    if (existing) return existing;

    const conversation: Conversation = {
      id: params.id,
      businessId: params.businessId,
      contactName: params.contactName,
      contactPhone: params.contactPhone,
      labels: [],
      status: "open",
      manualMode: false,
      unreadCount: 0,
      updatedAt: new Date().toISOString(),
      messages: [],
      importedFromHistory: true,
      flowState: "IDLE",
    };
    return this.save(conversation);
  }

  setFlowState(businessId: string, id: string, state: ConversationFlowState): Conversation | undefined {
    const conversation = this.conversations.get(keyOf(businessId, id));
    if (!conversation) return undefined;
    return this.save({ ...conversation, flowState: state });
  }

  setTriage(businessId: string, id: string, triage: ConversationTriage): Conversation | undefined {
    const conversation = this.conversations.get(keyOf(businessId, id));
    if (!conversation) return undefined;
    return this.save({ ...conversation, lastTriage: triage });
  }

  setBookingSession(businessId: string, id: string, session: BookingSession): Conversation | undefined {
    const conversation = this.conversations.get(keyOf(businessId, id));
    if (!conversation) return undefined;
    return this.save({ ...conversation, bookingSession: session });
  }

  clearBookingSession(businessId: string, id: string): Conversation | undefined {
    const conversation = this.conversations.get(keyOf(businessId, id));
    if (!conversation) return undefined;
    const next = { ...conversation };
    delete next.bookingSession;
    return this.save(next);
  }

  addMessage(businessId: string, conversationId: string, message: ConversationMessage, incrementUnread: boolean): Conversation | undefined {
    const conversation = this.conversations.get(keyOf(businessId, conversationId));
    if (!conversation) return undefined;

    if (conversation.messages.some((m) => m.id === message.id)) return conversation;

    const updated: Conversation = {
      ...conversation,
      messages: [...conversation.messages, message],
      updatedAt: message.timestamp,
      unreadCount: incrementUnread ? conversation.unreadCount + 1 : conversation.unreadCount,
    };
    this.save(updated);
    whatsappEvents.emit(businessId, { type: "message", payload: { conversationId, message } });
    return updated;
  }

  setStatus(businessId: string, id: string, status: ConversationStatus): Conversation | undefined {
    const conversation = this.conversations.get(keyOf(businessId, id));
    if (!conversation) return undefined;
    return this.save({ ...conversation, status });
  }

  toggleLabel(businessId: string, id: string, label: ConversationLabel): Conversation | undefined {
    const conversation = this.conversations.get(keyOf(businessId, id));
    if (!conversation) return undefined;
    const labels = conversation.labels.includes(label)
      ? conversation.labels.filter((l) => l !== label)
      : [...conversation.labels, label];
    return this.save({ ...conversation, labels });
  }

  setManualMode(businessId: string, id: string, manualMode: boolean): Conversation | undefined {
    const conversation = this.conversations.get(keyOf(businessId, id));
    if (!conversation) return undefined;
    return this.save({ ...conversation, manualMode });
  }

  markRead(businessId: string, id: string): Conversation | undefined {
    const conversation = this.conversations.get(keyOf(businessId, id));
    if (!conversation) return undefined;
    return this.save({ ...conversation, unreadCount: 0 });
  }
}

declare global {
  var __whatsappConversationRepository: ConversationRepository | undefined;
}

export const conversationRepository =
  globalThis.__whatsappConversationRepository ?? new ConversationRepository();
globalThis.__whatsappConversationRepository = conversationRepository;
