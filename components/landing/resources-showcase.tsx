"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

const RESOURCES = [
  { name: "Cancha 1", available: false },
  { name: "Cancha 2", available: true },
  { name: "Cancha 3", available: true },
];

const USE_CASES = ["Canchas", "Salas", "Profesionales", "Consultorios"];

export function LandingResourcesShowcase() {
  return (
    <section id="recursos" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <p className="text-sm font-medium text-primary">Más que una agenda simple</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
              Una agenda que entiende tus recursos
            </h2>
            <p className="mt-5 text-muted-foreground">
              Si un mismo servicio puede prestarse con varios recursos en paralelo, Mi Agenda
              gestiona la disponibilidad de cada uno por separado — y ofrece un horario como
              disponible mientras quede al menos uno libre.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {USE_CASES.map((useCase) => (
                <span
                  key={useCase}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
                >
                  {useCase}
                </span>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="order-1 mx-auto w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/5 lg:order-2"
          >
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
              <p className="text-sm font-semibold text-foreground">Fútbol 5</p>
              <span className="text-xs text-muted-foreground">19:00</span>
            </div>
            <div className="flex flex-col gap-2 p-4">
              {RESOURCES.map((resource) => (
                <div
                  key={resource.name}
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-background px-3.5 py-2.5"
                >
                  <span className="text-sm text-foreground">{resource.name}</span>
                  {resource.available ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3" />
                      Disponible
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <X className="size-3" />
                      Ocupada
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-border bg-emerald-500/5 px-5 py-3 text-center text-xs font-medium text-emerald-700 dark:text-emerald-400">
              19:00 disponible — se asigna Cancha 2
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
