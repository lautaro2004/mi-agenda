"use client";

import { motion } from "framer-motion";
import {
  Bot,
  CalendarClock,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";

const reasons = [
  {
    icon: MessageSquareText,
    title: "Respuestas más rápidas",
    description:
      "Tus clientes reciben respuestas claras sobre servicios, horarios y precios al instante, sin esperar.",
  },
  {
    icon: CalendarClock,
    title: "Turnos organizados automáticamente",
    description:
      "Cada reserva se ordena según tus horarios y servicios, sin planillas ni anotaciones sueltas.",
  },
  {
    icon: Timer,
    title: "Atención 24/7",
    description:
      "Aunque tu negocio esté cerrado, tus clientes pueden consultar y reservar en cualquier momento.",
  },
  {
    icon: ShieldCheck,
    title: "Mejor experiencia para tus clientes",
    description:
      "Información siempre actualizada y consistente, sin importar quién responda el chat.",
  },
  {
    icon: Sparkles,
    title: "Catálogo de servicios siempre a mano",
    description:
      "Tus servicios, precios y duraciones quedan organizados y listos para compartir.",
  },
  {
    icon: Bot,
    title: "Preparado para la IA",
    description:
      "La base está lista para sumar un asistente con inteligencia artificial que responda por vos.",
  },
];

export function LandingWhyChoose() {
  return (
    <section id="por-que-mi-agenda" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Por qué elegir Mi Agenda
          </h2>
          <p className="mt-4 text-muted-foreground">
            Mucho más que un WhatsApp Business: una base organizada para que tu
            negocio responda mejor, agende solo y crezca sin perder el toque
            personal.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reasons.map((reason, index) => (
            <motion.div
              key={reason.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="rounded-2xl border border-border bg-card p-6 transition-shadow hover:shadow-lg hover:shadow-primary/5"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <reason.icon className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {reason.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {reason.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
