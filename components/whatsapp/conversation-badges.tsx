import { cn } from "@/lib/utils";
import {
  CONVERSATION_LABEL_META,
  CONVERSATION_STATUS_META,
  type ConversationLabel,
  type ConversationStatus,
} from "@/lib/types";

export function ConversationLabelBadge({ label, className }: { label: ConversationLabel; className?: string }) {
  const meta = CONVERSATION_LABEL_META[label];

  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap", meta.className, className)}>
      {meta.label}
    </span>
  );
}

export function ConversationStatusBadge({ status, className }: { status: ConversationStatus; className?: string }) {
  const meta = CONVERSATION_STATUS_META[status];

  return (
    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-xs font-medium whitespace-nowrap", meta.className, className)}>
      {meta.label}
    </span>
  );
}
