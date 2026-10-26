import Link from "next/link";
import { AlertTriangle, ArrowDownCircle } from "lucide-react";

import type { BusinessSubscription } from "@/modules/billing/subscription";

const dateFmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "America/Argentina/Buenos_Aires" });

// Avisos de facturación de Nexo (server component, sin fetch extra):
// - Gracia por pago atrasado: cuándo vence y qué pasa después.
// - Ya degradado al plan gratuito: qué quedó en pausa y que se conserva.
// Nada de esto bloquea el uso: el acceso efectivo ya lo resuelve el servidor.
export function BillingBanner({ subscription }: { subscription: BusinessSubscription | null }) {
  if (!subscription) return null;
  const { nexoAccess, plan, nexoPlan, nexoOnBaseTier } = subscription;

  if (nexoAccess.access === "grace") {
    return (
      <div className="flex flex-col gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-start gap-2 text-foreground sm:items-center">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 sm:mt-0" />
          <span>
            Tenés un pago pendiente de tu plan {plan.name}. Regularizalo antes del{" "}
            <strong>{dateFmt.format(nexoAccess.graceEndsAt)}</strong>: después, Nexo pasa al plan gratuito (tu
            configuración se conserva).
          </span>
        </p>
        <Link href="/dashboard/suscripcion" className="shrink-0 font-medium text-amber-700 underline-offset-4 hover:underline dark:text-amber-400">
          Ver mi suscripción
        </Link>
      </div>
    );
  }

  // Degradado: tenía un plan pago y hoy funciona con el gratuito. No se
  // muestra a quien simplemente está en el gratuito ni a quien contrató solo
  // Nodo (ahí el gratuito de Nexo es lo esperado).
  if (nexoOnBaseTier && plan.id !== nexoPlan.id && plan.products.includes("nexo")) {
    return (
      <div className="flex flex-col gap-2 border-b border-border bg-muted/60 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-start gap-2 text-foreground sm:items-center">
          <ArrowDownCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground sm:mt-0" />
          <span>
            Tu plan {plan.name} está en pausa y Nexo funciona con el plan gratuito. Tu web, tu configuración y tus datos
            están guardados: vuelven al reactivar un plan que los incluya.
          </span>
        </p>
        <Link href="/dashboard/suscripcion" className="shrink-0 font-medium underline-offset-4 hover:underline">
          Reactivar
        </Link>
      </div>
    );
  }

  return null;
}
