"use client";

import { motion } from "framer-motion";
import { Check, Minus, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const rows = [
  { label: "Registra turnos", legacy: true, nexo: true },
  { label: "Entiende el contexto del negocio", legacy: false, nexo: true },
  { label: "Responde consultas de clientes", legacy: false, nexo: true },
  { label: "Conoce servicios y horarios", legacy: false, nexo: true },
  { label: "Gestiona reservas y recursos", legacy: false, nexo: true },
  { label: "Conocimiento centralizado", legacy: false, nexo: true },
  { label: "Combina web + IA + WhatsApp", legacy: false, nexo: true },
] as const;

function StatusIcon({ value }: { value: boolean }) {
  if (value) {
    return (
      <span className="inline-flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <Check className="size-3.5" />
      </span>
    );
  }
  return (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Minus className="size-3.5" />
    </span>
  );
}

export function LandingComparison() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Una agenda tradicional espera
            <br />
            que vos hagas todo.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Una agenda solo guarda turnos. El cliente tiene que saber qué preguntar, la información
            queda dispersa y la configuración es manual. Nexo entiende tu negocio y actúa sobre él.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mt-14 overflow-hidden rounded-2xl border border-border bg-card"
        >
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-border bg-muted/30 px-4 py-4 sm:px-6">
            <span className="text-sm font-medium text-muted-foreground">Funcionalidad</span>
            <span className="w-20 text-center text-sm font-medium text-muted-foreground sm:w-28">
              Agenda tradicional
            </span>
            <span className="flex w-20 items-center justify-center gap-1 text-center text-sm font-semibold text-primary sm:w-28">
              <Sparkles className="size-3.5" />
              Nexo
            </span>
          </div>

          {rows.map((row, index) => (
            <div
              key={row.label}
              className={cn(
                "grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-4 py-3.5 sm:px-6",
                index % 2 === 1 && "bg-muted/20"
              )}
            >
              <span className="text-sm text-foreground">{row.label}</span>
              <span className="flex w-20 justify-center sm:w-28">
                <StatusIcon value={row.legacy} />
              </span>
              <span className="flex w-20 justify-center sm:w-28">
                <StatusIcon value={row.nexo} />
              </span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
