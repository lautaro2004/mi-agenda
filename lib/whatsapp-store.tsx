"use client";

import * as React from "react";
import {
  Conversation,
  ConversationLabel,
  ConversationStatus,
  WhatsAppConnection,
  WhatsAppEvent,
} from "@/lib/types";

interface WhatsAppState {
  connection: WhatsAppConnection;
  conversations: Conversation[];
}

const initialConnection: WhatsAppConnection = {
  status: "disconnected",
  phoneNumber: null,
  connectedAt: null,
  lastError: null,
  aiEnabled: true,
  qr: null,
};

const initialState: WhatsAppState = {
  connection: initialConnection,
  conversations: [],
};

interface WhatsAppContextValue {
  state: WhatsAppState;
  loading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setAiEnabled: (enabled: boolean) => Promise<void>;
  setConversationStatus: (id: string, status: ConversationStatus) => Promise<void>;
  toggleConversationLabel: (id: string, label: ConversationLabel) => Promise<void>;
  setConversationManualMode: (id: string, manualMode: boolean) => Promise<void>;
  markConversationRead: (id: string) => Promise<void>;
  sendMessage: (id: string, text: string) => Promise<void>;
}

const WhatsAppContext = React.createContext<WhatsAppContextValue | null>(null);

export function WhatsAppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<WhatsAppState>(initialState);
  const [loading, setLoading] = React.useState(true);

  const upsertConversation = React.useCallback((conversation: Conversation) => {
    setState((prev) => {
      const index = prev.conversations.findIndex((c) => c.id === conversation.id);
      const conversations =
        index === -1
          ? [...prev.conversations, conversation]
          : prev.conversations.map((c) => (c.id === conversation.id ? conversation : c));
      conversations.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return { ...prev, conversations };
    });
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [statusRes, conversationsRes] = await Promise.all([
          fetch("/api/whatsapp/status"),
          fetch("/api/whatsapp/conversations"),
        ]);
        const statusData = (await statusRes.json()) as { connection: WhatsAppConnection };
        const conversationsData = (await conversationsRes.json()) as { conversations: Conversation[] };

        if (cancelled) return;
        setState({ connection: statusData.connection, conversations: conversationsData.conversations });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const source = new EventSource("/api/whatsapp/events");

    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as WhatsAppEvent;
      if (data.type === "connection") {
        setState((prev) => ({ ...prev, connection: data.payload }));
      } else if (data.type === "conversation") {
        upsertConversation(data.payload);
      }
    };

    return () => {
      source.close();
    };
  }, [upsertConversation]);

  const value = React.useMemo<WhatsAppContextValue>(
    () => ({
      state,
      loading,
      connect: async () => {
        const res = await fetch("/api/whatsapp/connect", { method: "POST" });
        const data = (await res.json()) as { connection: WhatsAppConnection };
        setState((prev) => ({ ...prev, connection: data.connection }));
      },
      disconnect: async () => {
        const res = await fetch("/api/whatsapp/disconnect", { method: "POST" });
        const data = (await res.json()) as { connection: WhatsAppConnection };
        setState((prev) => ({ ...prev, connection: data.connection }));
      },
      setAiEnabled: async (enabled) => {
        const res = await fetch("/api/whatsapp/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        });
        const data = (await res.json()) as { connection: WhatsAppConnection };
        setState((prev) => ({ ...prev, connection: data.connection }));
      },
      setConversationStatus: async (id, status) => {
        const res = await fetch(`/api/whatsapp/conversations/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const data = (await res.json()) as { conversation: Conversation };
        upsertConversation(data.conversation);
      },
      toggleConversationLabel: async (id, label) => {
        const res = await fetch(`/api/whatsapp/conversations/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ toggleLabel: label }),
        });
        const data = (await res.json()) as { conversation: Conversation };
        upsertConversation(data.conversation);
      },
      setConversationManualMode: async (id, manualMode) => {
        const res = await fetch(`/api/whatsapp/conversations/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manualMode }),
        });
        const data = (await res.json()) as { conversation: Conversation };
        upsertConversation(data.conversation);
      },
      markConversationRead: async (id) => {
        const res = await fetch(`/api/whatsapp/conversations/${encodeURIComponent(id)}/read`, {
          method: "POST",
        });
        const data = (await res.json()) as { conversation: Conversation };
        upsertConversation(data.conversation);
      },
      sendMessage: async (id, text) => {
        const res = await fetch(`/api/whatsapp/conversations/${encodeURIComponent(id)}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { conversation: Conversation };
        upsertConversation(data.conversation);
      },
    }),
    [state, loading, upsertConversation]
  );

  return <WhatsAppContext.Provider value={value}>{children}</WhatsAppContext.Provider>;
}

export function useWhatsApp() {
  const ctx = React.useContext(WhatsAppContext);
  if (!ctx) {
    throw new Error("useWhatsApp must be used within a WhatsAppProvider");
  }
  return ctx;
}
