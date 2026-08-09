import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ConversationLabelBadge, ConversationStatusBadge } from "@/components/whatsapp/conversation-badges";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Conversation } from "@/lib/types";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ConversationListItem({ conversation }: { conversation: Conversation }) {
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  const needsAttention = conversation.labels.includes("human_required") || conversation.unreadCount > 0;

  return (
    <Link
      href={`/dashboard/whatsapp/conversaciones/${encodeURIComponent(conversation.id)}`}
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/40",
        conversation.unreadCount > 0 && "bg-primary/[0.03]"
      )}
    >
      <Avatar size="lg" className="shrink-0">
        <AvatarFallback className="bg-muted text-sm font-medium text-foreground">
          {/^\+?\d/.test(conversation.contactName) ? "?" : getInitials(conversation.contactName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={cn("truncate text-sm", conversation.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground")}>
            {conversation.contactName}
          </p>
          {needsAttention && <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-label="Requiere atención" />}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{lastMessage?.text}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {conversation.labels.map((label) => (
            <ConversationLabelBadge key={label} label={label} />
          ))}
          {conversation.importedFromHistory && (
            <span className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <Clock className="size-2.5 shrink-0" />
              Últ. 24 hs
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-xs text-muted-foreground">{formatRelativeTime(conversation.updatedAt)}</span>
        <ConversationStatusBadge status={conversation.status} />
        {conversation.unreadCount > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {conversation.unreadCount}
          </span>
        )}
      </div>
    </Link>
  );
}
