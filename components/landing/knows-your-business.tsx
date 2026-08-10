"use client";

import { motion } from "framer-motion";
import { Boxes, CalendarCheck2, GraduationCap, MessageSquareText } from "lucide-react";

const blocks = [
  {
    icon: GraduationCap,
    title: "Aprende de tu negocio",
    description: "Contale cómo funciona tu negocio y Mi Agenda arma la configuración por vos.",
    visual: (
      <div className="space-y-1.5">
        <div className="w-4/5 rounded-lg rounded-bl-sm bg-background px-2.5 py-1.5 text-[11px] text-foreground">
          Somos una agencia de desarrollo web…
        </div>
        <div className="ml-auto w-4/5 rounded-lg rounded-br-sm bg-primary px-2.5 py-1.5 text-[11px] text-primary-foreground">
          Guardado. Servicios y precios listos ✓
        </div>
      </div>
    ),
  },
  {
    icon: MessageSquareText,
    title: "Atiende por WhatsApp",
    description: "Responde consultas usando tus servicios, precios, preguntas frecuentes y reglas.",
    visual: (
      <div className="flex items-center gap-2 rounded-lg bg-background px-2.5 py-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <span className="size-1.5 rounded-full bg-current" />
        </span>
        <p className="text-[11px] text-foreground">Respondiendo a Martina G. — hace 2 min</p>
      </div>
    ),
  },
  {
    icon: CalendarCheck2,
    title: "Gestiona reservas",
    description: "Consulta disponibilidad y agenda turnos sin que tengas que intervenir.",
    visual: (
      <div className="flex items-center justify-between rounded-lg bg-background px-2.5 py-2 text-[11px]">
        <span className="text-foreground">Landing Page · mañana 11:00</span>
        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-600 dark:text-emerald-400">
          Confirmado
        </span>
      </div>
    ),
  },
  {
    icon: Boxes,
    title: "Entiende tus recursos",
    description: "Canchas, profesionales, salas u otros recursos pueden asociarse a tus servicios.",
    visual: (
      <div className="flex gap-1.5">
        {["Cancha 1", "Cancha 2", "Cancha 3"].map((r, i) => (
          <span
            key={r}
            className={`flex-1 rounded-lg px-1.5 py-2 text-center text-[10px] font-medium ${
              i === 0
                ? "bg-muted text-muted-foreground line-through"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {r}
          </span>
        ))}
      </div>
    ),
  },
];

export function LandingKnowsYourBusiness() {
  return (
    <section id="producto" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Un asistente que realmente conoce tu negocio
          </h2>
          <p className="mt-4 text-muted-foreground">
            No es un chatbot con respuestas genéricas. Es un empleado virtual configurado
            específicamente para cómo trabajás vos.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {blocks.map((block, index) => (
            <motion.div
              key={block.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <block.icon className="size-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">{block.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground">{block.description}</p>
              <div className="mt-auto rounded-xl border border-border/60 bg-muted/30 p-2.5">{block.visual}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
