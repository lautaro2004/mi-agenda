"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PLAN_DETAILS } from "@/lib/mock-data";

export function LandingPricing() {
  const plan = PLAN_DETAILS.unico;

  return (
    <section id="planes" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Un plan simple para empezar
          </h2>
          <p className="mt-4 text-muted-foreground">
            Sin sorpresas ni configuraciones complicadas. Un único plan con
            todo lo que necesitás.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto mt-14 max-w-md"
        >
          <div className="rounded-2xl border border-primary/30 bg-card p-8 shadow-xl shadow-primary/5">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Recomendado
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight text-foreground">
                ${plan.price.toLocaleString("es-AR")}
              </span>
              <span className="text-sm text-muted-foreground">
                {plan.currency} / {plan.period}
              </span>
            </div>

            <ul className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-foreground">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {feature}
                </li>
              ))}
            </ul>

            <Button className="mt-8 w-full" size="lg" render={<Link href="/registro" />} nativeButton={false}>
              Empezar ahora
            </Button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Activación vía Mercado Pago. Podés cancelar cuando quieras.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
