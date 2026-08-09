"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { SubscriptionStatusBadge } from "@/components/subscription-status-badge";
import { PLAN_DETAILS } from "@/lib/mock-data";
import { createCheckoutPreference } from "@/lib/payments/mercado-pago";
import { useOnboarding } from "@/lib/onboarding-store";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default function SubscriptionSettingsPage() {
  const { state, setSubscription } = useOnboarding();
  const [loading, setLoading] = React.useState(false);
  const plan = PLAN_DETAILS.unico;
  const { subscription } = state;

  async function handleActivate() {
    setLoading(true);
    await createCheckoutPreference(subscription);
    setSubscription({
      status: "active",
      startDate: new Date().toISOString(),
      renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    setLoading(false);
    toast.success("Suscripción activada");
  }

  return (
    <div>
      <PageHeader
        title="Suscripción"
        description="Gestioná el plan de tu negocio."
      />

      <div className="max-w-xl rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{plan.name}</h2>
          <SubscriptionStatusBadge status={subscription.status} />
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

        {subscription.status === "active" && subscription.startDate && subscription.renewsAt ? (
          <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl border border-border p-4 text-sm">
            <div>
              <p className="text-muted-foreground">Activa desde</p>
              <p className="font-medium text-foreground">
                {dateFormatter.format(new Date(subscription.startDate))}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Próxima renovación</p>
              <p className="font-medium text-foreground">
                {dateFormatter.format(new Date(subscription.renewsAt))}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6">
            <Button onClick={handleActivate} disabled={loading} className="w-full" size="lg">
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Procesando con Mercado Pago…" : "Activar suscripción"}
            </Button>
          </div>
        )}

        <p className="mt-3 text-center text-xs text-muted-foreground">
          La integración con Mercado Pago estará disponible próximamente.
        </p>
      </div>
    </div>
  );
}
