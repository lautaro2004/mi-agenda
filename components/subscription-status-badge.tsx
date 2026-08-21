import { Badge } from "@/components/ui/badge";
import type { BillingSubscriptionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// Repurposed para el estado REAL de Subscription (ver
// modules/billing/subscription.ts) — antes tipaba contra el mock viejo de 3
// estados (pending/active/expired). Sin otros consumidores además de
// /dashboard/suscripcion y /onboarding/suscripcion, se pudo reusar este
// mismo componente en vez de crear uno paralelo.
const STATUS_CONFIG: Record<BillingSubscriptionStatus, { label: string; className: string }> = {
  trialing: {
    label: "Prueba gratuita",
    className: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  active: {
    label: "Activo",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  past_due: {
    label: "Pago pendiente",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  canceled: {
    label: "Cancelado",
    className: "bg-destructive/10 text-destructive",
  },
  expired: {
    label: "Vencido",
    className: "bg-destructive/10 text-destructive",
  },
};

export function SubscriptionStatusBadge({ status }: { status: BillingSubscriptionStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", config.className)}>
      {config.label}
    </Badge>
  );
}
