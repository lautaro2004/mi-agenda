import { Badge } from "@/components/ui/badge";
import type { SubscriptionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; className: string }> = {
  active: {
    label: "Activa",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  pending: {
    label: "Pendiente de pago",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  expired: {
    label: "Vencida",
    className: "bg-destructive/10 text-destructive",
  },
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
