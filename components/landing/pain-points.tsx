"use client";

import { motion } from "framer-motion";
import { Clock, MessageSquareOff, MessageSquareWarning, UserX, CalendarX2, RefreshCcw } from "lucide-react";

const painPoints = [
  {
    icon: RefreshCcw,
    title: "Repetir las mismas respuestas",
    description: "Horarios, precios y direcciones, una y otra vez, todos los días.",
  },
  {
    icon: MessageSquareOff,
    title: "Mensajes que se pierden",
    description: "Entre tantos chats, algunas consultas quedan sin respuesta.",
  },
  {
    icon: UserX,
    title: "Clientes que se van a la competencia",
    description: "Si tardás en responder, muchos prueban con otro negocio.",
  },
  {
    icon: Clock,
    title: "Consultas fuera de horario",
    description: "Tus clientes escriben a cualquier hora, pero vos no podés estar siempre disponible.",
  },
  {
    icon: CalendarX2,
    title: "Agenda desorganizada",
    description: "Turnos anotados en papel, agendas y chats distintos que nunca cierran.",
  },
  {
    icon: MessageSquareWarning,
    title: "Dudas que se acumulan",
    description: "Las preguntas frecuentes te interrumpen el día a día una y otra vez.",
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
