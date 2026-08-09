"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StepActions } from "@/components/onboarding/step-actions";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { PLAN_DETAILS } from "@/lib/mock-data";
import { createCheckoutPreference } from "@/lib/payments/mercado-pago";
import { useOnboarding } from "@/lib/onboarding-store";

export default function SubscriptionStepPage() {
  const router = useRouter();
  const { state, setSubscription, completeOnboarding } = useOnboarding();
  const [loading, setLoading] = React.useState(false);
  const plan = PLAN_DETAILS.unico;

  async function handleActivate() {
    setLoading(true);
    await createCheckoutPreference(state.subscription);
    setSubscription({
      status: "active",
      startDate: new Date().toISOString(),
      renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    setLoading(false);
  }

  function handleFinish() {
    completeOnboarding();
    router.push("/dashboard");
  }

  const isActive = state.subscription.status === "active";

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Activá tu suscripción
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Un único plan, sin sorpresas. La integración con Mercado Pago estará disponible próximamente.
        </p>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-muted/30 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{plan.name}</h2>
          <SubscriptionStatusBadge status={state.subscription.status} />
        </div>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-3xl font-semibold tracking-tight text-foreground">
            ${plan.price.toLocaleString("es-AR")}
          </span>
          <span className="text-sm text-muted-foreground">
            {plan.currency} / {plan.period}
          </span>
        </div>

        <ul className="mt-6 space-y-2.5">
          {plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-6">
          {isActive ? (
            <p className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
              Tu suscripción está activa. Ya podés finalizar la configuración.
            </p>
          ) : (
            <Button onClick={handleActivate} disabled={loading} className="w-full" size="lg">
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Procesando con Mercado Pago…" : "Activar suscripción"}
            </Button>
          )}
        </div>
      </div>

      <StepActions
        backHref="/onboarding/preguntas-frecuentes"
        onNext={handleFinish}
        nextLabel="Finalizar configuración"
        nextDisabled={!isActive}
      />
    </div>
  );
}
