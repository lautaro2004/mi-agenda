"use client";

import { motion } from "framer-motion";
import { MessageCircle, Settings2, Sparkles } from "lucide-react";

const steps = [
  {
    icon: MessageCircle,
    title: "Contale",
    description: "Contale a Nexo cómo funciona tu negocio.",
  },
  {
    icon: Settings2,
    title: "Configurá",
    description: "Revisá servicios, horarios, información y canales.",
  },
  {
    icon: Sparkles,
    title: "Dejalo trabajar",
    description: "Nexo empieza a ayudarte con las consultas y tareas de tu negocio.",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="como-funciona" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            De cero a asistente en minutos
          </h2>
          <p className="mt-4 text-muted-foreground">
            Sin planillas, sin manuales. Un recorrido simple, de principio a fin.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              className="flex flex-col gap-4 bg-card p-8"
            >
              <div className="flex items-center justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="size-5" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
