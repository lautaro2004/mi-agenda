"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageBubble } from "@/components/whatsapp/message-bubble";
import { ConversationLabelBadge } from "@/components/whatsapp/conversation-badges";
import { ConversationTriagePanel } from "@/components/whatsapp/conversation-triage-panel";
import { useWhatsApp } from "@/lib/whatsapp-store";
import {
  CONVERSATION_LABELS,
  CONVERSATION_STATUSES,
  CONVERSATION_STATUS_META,
  type ConversationLabel,
  type ConversationStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const { state, setConversationStatus, toggleConversationLabel, setConversationManualMode, markConversationRead, sendMessage } =
    useWhatsApp();
  const [draft, setDraft] = React.useState("");
  const bottomRef = React.useRef<HTMLDivElement>(null);

  const conversationId = decodeURIComponent(params.id ?? "");
  const conversation = state.conversations.find((c) => c.id === conversationId);

  React.useEffect(() => {
    if (conversation && conversation.unreadCount > 0) {
      markConversationRead(conversation.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id]);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [conversation?.messages.length]);

  if (!conversation) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/whatsapp/conversaciones" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Volver a conversaciones
        </Link>
        <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
          No encontramos esta conversación.
        </div>
      </div>
    );
  }

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    sendMessage(conversation!.id, draft.trim());
    setDraft("");
  }

  return (
    <div>
      <Link href="/dashboard/whatsapp/conversaciones" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
        Volver a conversaciones
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] lg:items-start">
        <div className="flex h-[calc(100vh-13rem)] flex-col rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-3.5">
            <h2 className="text-base font-semibold text-foreground">{conversation.contactName}</h2>
            <p className="text-sm text-muted-foreground">{conversation.contactPhone}</p>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {conversation.messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="flex items-end gap-2 border-t border-border p-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Escribí un mensaje…"
              rows={1}
              className="min-h-9"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
            />
            <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Enviar mensaje">
              <Send className="size-4" />
            </Button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">Estado</h3>
            <Select
              value={conversation.status}
              onValueChange={(value) => setConversationStatus(conversation.id, value as ConversationStatus)}
            >
              <SelectTrigger className="mt-2 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONVERSATION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {CONVERSATION_STATUS_META[status].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">Etiquetas</h3>
            <p className="mt-1 text-sm text-muted-foreground">Clasificá esta conversación para encontrarla más fácil.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CONVERSATION_LABELS.map((label) => {
                const isActive = conversation.labels.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleConversationLabel(conversation.id, label as ConversationLabel)}
                    className={cn("rounded-full transition-opacity", !isActive && "opacity-40 hover:opacity-70")}
                  >
                    <ConversationLabelBadge label={label} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Modo manual</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pausá las respuestas automáticas de la IA para esta conversación y respondé vos mismo.
                </p>
              </div>
              <Switch
                checked={conversation.manualMode}
                onCheckedChange={(checked) => setConversationManualMode(conversation.id, checked)}
                aria-label="Activar modo manual para esta conversación"
              />
            </div>
          </div>

          <ConversationTriagePanel conversation={conversation} />
        </div>
      </div>
    </div>
  );
}
