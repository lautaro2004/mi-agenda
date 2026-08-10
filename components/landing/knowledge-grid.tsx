"use client";

import { motion } from "framer-motion";
import {
  Boxes,
  Brain,
  CalendarClock,
  Compass,
  ListChecks,
  MessageCircleQuestion,
  ShieldAlert,
  Smile,
  Tag,
} from "lucide-react";

const items = [
  { icon: ListChecks, title: "Servicios", description: "Qué ofrecés." },
  { icon: Tag, title: "Precios", description: "Cuánto cuesta cada cosa." },
  { icon: MessageCircleQuestion, title: "Preguntas frecuentes", description: "Respuestas listas para las dudas habituales." },
  { icon: CalendarClock, title: "Horarios", description: "Cuándo puede ofrecer reservas." },
  { icon: Compass, title: "Objetivos", description: "Qué debería priorizar en cada conversación." },
  { icon: ShieldAlert, title: "Restricciones", description: "Qué nunca debería hacer." },
  { icon: Smile, title: "Personalidad", description: "Cómo habla con tus clientes." },
  { icon: Brain, title: "Memoria", description: "Información adicional sobre cómo funciona tu negocio." },
  { icon: Boxes, title: "Recursos", description: "Canchas, salas, profesionales y otros recursos disponibles." },
];

export function LandingKnowledgeGrid() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Todo lo que tu asistente necesita saber
          </h2>
          <p className="mt-4 text-muted-foreground">
            Nueve piezas de información, todas conectadas entre sí, listas para que tu asistente
            las use en cada conversación.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item, index) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: index * 0.03 }}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="size-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
