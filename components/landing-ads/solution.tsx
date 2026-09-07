"use client";

import { motion } from "framer-motion";
import { CalendarCheck2, Globe, Settings2 } from "lucide-react";

const STEPS = [
  { number: "01", icon: Settings2, title: "Configurá tu negocio", description: "Servicios, precios y horarios reales — en minutos." },
  { number: "02", icon: Globe, title: "Publicá tu espacio online", description: "Tu propio sitio, listo para compartir." },
  { number: "03", icon: CalendarCheck2, title: "Recibí consultas y reservas", description: "Todo llega organizado a un solo lugar." },
] as const;

// Sección 3 del pedido: tres pasos, nada más — visual simple para que se
// entienda de un vistazo, sin bloques de funcionalidades.
export function LandingAdsSolution() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl"
        >
          Con Nexo, organizás tu negocio.
        </motion.h2>

        <div className="mt-12 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-8 text-center"
            >
              <span className="text-sm font-semibold text-primary">{step.number}</span>
              <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <step.icon className="size-5" />
              </span>
              <p className="font-medium text-foreground">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
