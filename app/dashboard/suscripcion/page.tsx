"use client";

import * as React from "react";
import { AlertTriangle, Bot, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlanCard } from "@/components/subscription-plan-card";
import { SubscriptionPromoCodeForm } from "@/components/subscription-promo-code-form";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  daysRemaining,
  useActivePlans,
  useBusinessSubscription,
  type AiUsageTotals,
  type BusinessSubscriptionInfo,
} from "@/lib/subscription-client";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" });
const numberFormatter = new Intl.NumberFormat("es-AR");

export default function SubscriptionSettingsPage() {
  const { data, loading, error, reload } = useBusinessSubscription();
  const { plans, loading: plansLoading } = useActivePlans();

  return (
    <div>
      <PageHeader title="Suscripción" description="Tu plan, tu período actual y cuánto consumiste de IA." />

      {loading ? (
        <div className="max-w-2xl space-y-4">
          <Skeleton className="h-[180px] rounded-2xl" />
          <Skeleton className="h-[140px] rounded-2xl" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">No pudimos cargar tu suscripción. Recargá la página.</p>
      ) : !data?.subscription ? (
        <div className="max-w-xl rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          No encontramos una suscripción para tu negocio todavía. Si esto no cambia en unos minutos, contactanos.
        </div>
      ) : (
        <div className="max-w-2xl space-y-6">
          <PlanBlock subscription={data.subscription} allowed={data.access.allowed} onCanceled={reload} />
          <AiUsageBlock aiUsage={data.aiUsage} aiCredits={data.subscription.plan.aiCredits} />
          <SubscriptionPromoCodeForm onApplied={reload} />
        </div>
      )}

      <div className="mt-10 max-w-4xl">
        <h2 className="text-base font-semibold text-foreground">Planes disponibles</h2>
        <p className="mt-1 text-sm text-muted-foreground">Contratá un plan pago con tu tarjeta, procesado por Mercado Pago.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plansLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[220px] rounded-2xl" />)
          ) : !plans || plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay planes disponibles por el momento.</p>
          ) : (
            plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isCurrent={plan.id === data?.subscription?.plan.id}
                onContracted={reload}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PlanBlock({
  subscription,
  allowed,
  onCanceled,
}: {
  subscription: BusinessSubscriptionInfo;
  allowed: boolean;
  onCanceled: () => void;
}) {
  const remaining = subscription.status === "trialing" ? daysRemaining(subscription.currentPeriodEnd) : null;
  const [canceling, setCanceling] = React.useState(false);

  // Cancelar solo tiene sentido si hay algo que cancelar del lado de
  // Mercado Pago y todavía no se canceló — un plan manual/beneficio/promo
  // no tiene cobro externo que cortar (ver cancel.ts).
  const canCancel = subscription.provider === "mercadopago" && subscription.status !== "canceled" && subscription.status !== "expired";

  async function handleCancel() {
    if (!confirm(`¿Cancelar tu suscripción a ${subscription.plan.name}? Dejará de cobrarse y volvés a Agenda interna.`)) return;

    setCanceling(true);
    try {
      const response = await fetch("/api/subscriptions/cancel", { method: "POST" });
      const body = await response.json().catch(() => ({ message: "No pudimos cancelar la suscripción." }));
      if (!response.ok) {
        toast.error(body.message ?? "No pudimos cancelar la suscripción.");
        return;
      }
      toast.success("Suscripción cancelada — volviste a Agenda interna.");
      onCanceled();
    } finally {
      setCanceling(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{subscription.plan.name}</h2>
        <SubscriptionStatusBadge status={subscription.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Inicio</p>
          <p className="font-medium text-foreground">
            {subscription.currentPeriodStart ? dateFormatter.format(new Date(subscription.currentPeriodStart)) : "—"}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Vencimiento</p>
          <p className="font-medium text-foreground">
            {subscription.currentPeriodEnd ? dateFormatter.format(new Date(subscription.currentPeriodEnd)) : "Sin fecha de fin"}
          </p>
        </div>
      </div>

      {subscription.status === "trialing" && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-sky-500/10 px-4 py-3 text-sm text-sky-700 dark:text-sky-400">
          <Sparkles className="size-4 shrink-0" />
          {remaining !== null ? (
            <span>
              Prueba gratuita — te quedan <strong>{remaining}</strong> {remaining === 1 ? "día" : "días"}.
            </span>
          ) : (
            <span>Prueba gratuita activa.</span>
          )}
        </div>
      )}

      {!allowed && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Tu suscripción no está activa — el asistente de IA dejó de responder hasta que elijas un plan. Tu
            información y configuración siguen guardadas.
          </span>
        </div>
      )}

      {subscription.status === "past_due" && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>Tenés un pago pendiente. Por ahora seguís teniendo acceso, pero convendría regularizarlo.</span>
        </div>
      )}

      {canCancel && (
        <div className="mt-4 border-t border-border pt-4">
          <Button size="sm" variant="outline" onClick={() => void handleCancel()} disabled={canceling}>
            {canceling ? "Cancelando…" : "Cancelar suscripción"}
          </Button>
        </div>
      )}
    </div>
  );
}

function AiUsageBlock({ aiUsage, aiCredits }: { aiUsage: AiUsageTotals; aiCredits: number }) {
  // Agenda interna y Esencial no incluyen IA (0 créditos): no hay consumo que mostrar.
  if (aiCredits === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Bot className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Uso de IA</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Tu plan no incluye IA ni créditos de IA. Pasate a Profesional para sumar WhatsApp con IA.
        </p>
      </div>
    );
  }

  const percent = aiCredits > 0 ? Math.min(100, Math.round((aiUsage.requests / aiCredits) * 100)) : 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <Bot className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Uso de IA</h2>
      </div>

      <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {numberFormatter.format(aiUsage.requests)} / {numberFormatter.format(aiCredits)} respuestas
      </p>
      <Progress value={percent} className="mt-3" />
      <p className="mt-2 text-xs text-muted-foreground">Este período · {percent}%</p>

      <p className="mt-4 text-xs text-muted-foreground">
        Los créditos representan respuestas de IA. El sistema también registra{" "}
        {numberFormatter.format(aiUsage.totalTokens)} tokens internamente para medir costos — eso no descuenta de tu
        límite de respuestas.
      </p>
    </div>
  );
}
