"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Sparkles } from "lucide-react";

import { PlanCard } from "@/components/subscription-plan-card";
import { StepActions } from "@/components/onboarding/step-actions";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnboarding } from "@/lib/onboarding-store";
import { daysRemaining, useActivePlans, useBusinessSubscription } from "@/lib/subscription-client";

// Ya no crea ninguna Subscription: solo LEE la que ya existe (todo negocio
// tiene una desde que se crea — ver ensureTrialSubscription en
// modules/billing/subscription.ts). La única fuente de verdad es
// Business → Subscription → Plan; esta pantalla nunca escribe acá.
export default function SubscriptionStepPage() {
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();
  const { data, loading, error } = useBusinessSubscription();
  const { plans, loading: plansLoading } = useActivePlans();

  function handleFinish() {
    completeOnboarding();
    router.push("/dashboard");
  }

  const subscription = data?.subscription ?? null;
  const remaining = subscription?.status === "trialing" ? daysRemaining(subscription.currentPeriodEnd) : null;

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Tu suscripción</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Así queda tu negocio configurado en cuanto a plan y acceso a la IA.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-[180px] rounded-2xl" />
      ) : error ? (
        <p className="text-sm text-destructive">No pudimos cargar tu suscripción. Recargá la página.</p>
      ) : !subscription ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
          No encontramos una suscripción para tu negocio todavía. Podés continuar igual — vas a poder revisarlo desde
          el dashboard.
        </div>
      ) : (
        <div className="rounded-2xl border border-primary/30 bg-muted/30 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">{subscription.plan.name}</h2>
            <SubscriptionStatusBadge status={subscription.status} />
          </div>

          {data?.access.allowed ? (
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
              <Sparkles className="size-4 shrink-0" />
              {subscription.status === "trialing" && remaining !== null ? (
                <span>
                  Ya tenés acceso — prueba gratuita activa, te quedan <strong>{remaining}</strong>{" "}
                  {remaining === 1 ? "día" : "días"}.
                </span>
              ) : (
                <span>Ya tenés acceso a tu asistente de IA.</span>
              )}
            </div>
          ) : (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>Tu suscripción no está activa todavía. Elegí un plan para habilitar la IA.</span>
            </div>
          )}
        </div>
      )}

      {!loading && !data?.access.allowed && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-foreground">Planes disponibles</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {plansLoading ? (
              Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[220px] rounded-2xl" />)
            ) : !plans || plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay planes disponibles por el momento.</p>
            ) : (
              plans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} isCurrent={plan.id === subscription?.plan.id} />
              ))
            )}
          </div>
        </div>
      )}

      <StepActions backHref="/onboarding/preguntas-frecuentes" onNext={handleFinish} nextLabel="Finalizar configuración" />
    </div>
  );
}
