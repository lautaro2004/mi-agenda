"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PLAN_SUBTITLE_BY_SLUG, buildPlanFeatureLines, type PublicPlan } from "@/lib/subscription-client";

function formatPrice(amount: number, currency: string): string {
  if (amount <= 0) return "Sin costo";
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${new Intl.NumberFormat("es-AR").format(amount)}`;
  }
}

// Los planes se venden por capacidad (uso de IA, funcionalidades
// disponibles) — nunca "cantidad de turnos". Todo lo que se muestra viene
// de Plan real (ver modules/billing/subscription.ts, listActivePlans()):
// si mañana se agregan más planes desde Superadmin, aparecen acá solos, sin
// tocar este componente.
export function PricingCards({ plans }: { plans: PublicPlan[] }) {
  if (plans.length === 0) {
    return (
      <div className="mx-auto mt-14 max-w-md rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Estamos terminando de definir los planes. Mientras tanto, podés crear tu cuenta y empezar
        con la agenda.
      </div>
    );
  }

  return (
    <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {plans.map((plan, index) => {
        const subtitle = PLAN_SUBTITLE_BY_SLUG[plan.slug];
        return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: index * 0.08 }}
            className="flex flex-col rounded-2xl border border-border bg-card p-8 shadow-sm"
          >
            <div className="flex items-baseline gap-2">
              <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
              {subtitle && <span className="text-sm font-medium text-primary">— {subtitle}</span>}
            </div>
            {plan.description && <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>}

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight text-foreground">
                {formatPrice(plan.monthlyPrice, plan.currency)}
              </span>
              {plan.monthlyPrice > 0 && <span className="text-sm text-muted-foreground">/ mes</span>}
            </div>

            <ul className="mt-6 space-y-3 text-sm text-foreground">
              {buildPlanFeatureLines(plan).map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {line}
                </li>
              ))}
            </ul>

            <Button className="mt-8 w-full" size="lg" render={<Link href="/registro" />} nativeButton={false}>
              Probar Nexo gratis
            </Button>
          </motion.div>
        );
      })}
    </div>
  );
}
