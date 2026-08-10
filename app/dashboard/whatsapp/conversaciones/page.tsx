"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationListItem } from "@/components/whatsapp/conversation-list-item";
import { ConversationLabelBadge } from "@/components/whatsapp/conversation-badges";
import { useWhatsApp } from "@/lib/whatsapp-store";
import { CONVERSATION_LABELS, type ConversationLabel, type ConversationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

function attentionScore(conversation: { labels: ConversationLabel[]; unreadCount: number; status: ConversationStatus }) {
  if (conversation.labels.includes("human_required")) return 2;
  if (conversation.unreadCount > 0) return 1;
  return 0;
}

export default function ConversationsPage() {
  const { state, loading } = useWhatsApp();
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<ConversationStatus | "all">("all");
  const [labelFilters, setLabelFilters] = React.useState<ConversationLabel[]>([]);

  function toggleLabelFilter(label: ConversationLabel) {
    setLabelFilters((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
  }

  const filtered = state.conversations
    .filter((c) => statusFilter === "all" || c.status === statusFilter)
    .filter((c) => labelFilters.length === 0 || c.labels.some((l) => labelFilters.includes(l)))
    .filter((c) => {
      if (!search.trim()) return true;
      const query = search.toLowerCase();
      const lastMessage = c.messages[c.messages.length - 1]?.text ?? "";
      return (
        c.contactName.toLowerCase().includes(query) ||
        c.contactPhone.toLowerCase().includes(query) ||
        lastMessage.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const scoreDiff = attentionScore(b) - attentionScore(a);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const statusCounts = {
    all: state.conversations.length,
    open: state.conversations.filter((c) => c.status === "open").length,
    waiting: state.conversations.filter((c) => c.status === "waiting").length,
    closed: state.conversations.filter((c) => c.status === "closed").length,
  };

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Conversaciones"
          description="Encontrá rápidamente las conversaciones que necesitan tu atención."
        />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Conversaciones"
        description="Encontrá rápidamente las conversaciones que necesitan tu atención."
      />

      {state.connection.status !== "connected" && (
        <div className="mb-6 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Tu WhatsApp todavía no está conectado.{" "}
          <Link href="/dashboard/whatsapp/conexion" className="font-medium text-primary hover:underline">
            Conectalo ahora
          </Link>{" "}
          para recibir conversaciones reales. Por ahora estás viendo datos de ejemplo.
        </div>
      )}

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, número o mensaje"
              className="pl-8"
            />
          </div>

          <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as ConversationStatus | "all")}>
            <TabsList>
              <TabsTrigger value="all">Todas ({statusCounts.all})</TabsTrigger>
              <TabsTrigger value="open">Abiertas ({statusCounts.open})</TabsTrigger>
              <TabsTrigger value="waiting">Esperando ({statusCounts.waiting})</TabsTrigger>
              <TabsTrigger value="closed">Cerradas ({statusCounts.closed})</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex flex-wrap gap-2">
          {CONVERSATION_LABELS.map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => toggleLabelFilter(label)}
              className={cn(
                "rounded-full transition-opacity",
                labelFilters.length > 0 && !labelFilters.includes(label) && "opacity-40"
              )}
            >
              <ConversationLabelBadge label={label} />
            </button>
          ))}
        </div>

        {filtered.length > 0 ? (
          <div className="space-y-2">
            {filtered.map((conversation) => (
              <ConversationListItem key={conversation.id} conversation={conversation} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
            No encontramos conversaciones con esos filtros.
          </div>
        )}
      </div>
    </div>
  );
}
