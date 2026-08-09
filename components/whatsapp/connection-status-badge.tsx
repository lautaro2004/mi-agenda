import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { WhatsAppConnectionStatus } from "@/lib/types";

const STATUS_META: Record<WhatsAppConnectionStatus, { label: string; className: string; dot: string }> = {
  disconnected: {
    label: "Desconectado",
    className: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  connecting: {
    label: "Conectando",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  reconnecting: {
    label: "Reconectando",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  connected: {
    label: "Conectado",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  error: {
    label: "Error",
    className: "bg-destructive/10 text-destructive",
    dot: "bg-destructive",
  },
};

export function ConnectionStatusBadge({ status, className }: { status: WhatsAppConnectionStatus; className?: string }) {
  const meta = STATUS_META[status];

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium",
        meta.className,
        className
      )}
    >
      {status === "connecting" || status === "reconnecting" ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span className={cn("size-1.5 rounded-full", meta.dot)} />
      )}
      {meta.label}
    </span>
  );
}
