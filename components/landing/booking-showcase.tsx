"use client";

import { motion } from "framer-motion";
import { CalendarCheck2, CalendarClock, MessageCircle, RefreshCcw, Boxes as ResourcesIcon, ListChecks } from "lucide-react";

const FLOW = [
  { from: "customer" as const, text: "Hola, ¿tenés disponibilidad mañana a las 19?" },
  { from: "assistant" as const, text: "Sí, tenemos disponibilidad a las 19:00." },
  { from: "customer" as const, text: "Perfecto, quiero reservar." },
  { from: "assistant" as const, text: "Listo, tu turno quedó reservado. ¡Te esperamos!" },
];

const capabilities = [
  { icon: CalendarClock, label: "Disponibilidad" },
  { icon: CalendarCheck2, label: "Reservas" },
  { icon: RefreshCcw, label: "Reprogramaciones" },
  { icon: ListChecks, label: "Servicios" },
  { icon: ResourcesIcon, label: "Recursos" },
];

export function LandingBookingShowcase() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            No solo responde.
            <br />
            También hace el trabajo.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Tu asistente consulta la disponibilidad real de tu negocio y confirma el turno en la
            misma conversación.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mx-auto mt-14 flex max-w-md flex-col gap-3"
        >
          {FLOW.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === "customer" ? "justify-start" : "justify-end"}`}>
              <div
                className={`flex max-w-[85%] items-center gap-2 rounded-2xl px-4 py-2.5 text-sm ${
                  msg.from === "customer" ? "bg-card border border-border text-foreground" : "bg-primary text-primary-foreground"
                }`}
              >
                {msg.from === "assistant" && <MessageCircle className="size-3.5 shrink-0 opacity-80" />}
                {msg.text}
              </div>
            </div>
          ))}
        </motion.div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-3">
          {capabilities.map((cap, index) => (
            <motion.span
              key={cap.label}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground"
            >
              <cap.icon className="size-4 text-primary" />
              {cap.label}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}
