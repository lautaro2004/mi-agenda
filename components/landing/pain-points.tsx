"use client";

import { motion } from "framer-motion";
import { Clock, MessageSquareOff, RefreshCcw, Split, CalendarX2, FileWarning } from "lucide-react";

const painPoints = [
  {
    icon: RefreshCcw,
    title: "Siempre las mismas preguntas",
    description: "Horarios, precios y direcciones, una y otra vez, todos los días.",
  },
  {
    icon: Split,
    title: "Reservas por mil canales distintos",
    description: "WhatsApp, Instagram, teléfono — cada una en un lugar diferente, difícil de seguir.",
  },
  {
    icon: MessageSquareOff,
    title: "Mensajes que quedan sin responder",
    description: "Entre tantos chats, algunas consultas se pierden y esos clientes no vuelven.",
  },
  {
    icon: CalendarX2,
    title: "Confirmar horarios a mano",
    description: "Ida y vuelta por chat para saber si hay un lugar libre, turno por turno.",
  },
  {
    icon: Clock,
    title: "Consultas fuera de horario",
    description: "Tus clientes escriben a cualquier hora, pero vos no podés estar siempre disponible.",
  },
  {
    icon: FileWarning,
    title: "Información desactualizada",
    description: "Precios viejos, horarios que cambiaron — y nadie avisó a los clientes.",
  },
];

export function LandingPainPoints() {
  return (
    <section id="problemas" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            ¿Te suena familiar?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Atender un negocio por WhatsApp a mano tiene un costo invisible:
            tiempo, clientes y oportunidades que se escapan todos los días.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {painPoints.map((point, index) => (
            <motion.div
              key={point.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <point.icon className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                {point.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {point.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
