"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, Scissors, Stethoscope, Briefcase } from "lucide-react";

import { cn } from "@/lib/utils";

// Ejemplos ilustrativos por rubro para la demo de la landing — no son
// respuestas generadas en vivo (eso requeriría exponer Gemini a visitantes
// anónimos, algo que el producto no hace hoy). Cada intercambio refleja
// capacidades reales del sistema: precio/disponibilidad de servicios,
// preguntas frecuentes y reservas — nada inventado.
const EXAMPLES = [
  {
    id: "cancha",
    label: "Cancha de fútbol",
    icon: Dumbbell,
    exchange: [
      { role: "customer" as const, text: "¿Cuánto sale alquilar una cancha los sábados?" },
      {
        role: "ai" as const,
        text: "Los sábados el fútbol 5 sale $18.000 la hora. ¿Querés que te muestre los horarios disponibles?",
      },
    ],
  },
  {
    id: "peluqueria",
    label: "Peluquería",
    icon: Scissors,
    exchange: [
      { role: "customer" as const, text: "¿Tienen turno para corte y barba mañana a la tarde?" },
      { role: "ai" as const, text: "Sí, tenemos lugar a las 16:30. ¿Querés que te lo reserve?" },
    ],
  },
  {
    id: "consultorio",
    label: "Consultorio",
    icon: Stethoscope,
    exchange: [
      { role: "customer" as const, text: "¿Atienden los martes por la tarde?" },
      {
        role: "ai" as const,
        text: "Sí, los martes atendemos de 14 a 19hs. ¿Querés coordinar un turno?",
      },
    ],
  },
  {
    id: "estudio",
    label: "Estudio profesional",
    icon: Briefcase,
    exchange: [
      { role: "customer" as const, text: "¿Hacen sitios web para pymes?" },
      {
        role: "ai" as const,
        text: "Sí, hacemos sitios institucionales desde USD 500. ¿Querés que te cuente qué incluye?",
      },
    ],
  },
] as const;

export function LandingSimulatorShowcase() {
  const [activeId, setActiveId] = React.useState<(typeof EXAMPLES)[number]["id"]>("cancha");
  const active = EXAMPLES.find((e) => e.id === activeId) ?? EXAMPLES[0];

  return (
    <section id="demo" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Probá cómo piensa Nexo
          </h2>
          <p className="mt-4 text-muted-foreground">
            Elegí un tipo de negocio y mirá el tipo de conversación que Nexo puede sostener.
          </p>
        </div>

        <div className="mx-auto mt-10 flex max-w-2xl flex-wrap justify-center gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example.id}
              type="button"
              onClick={() => setActiveId(example.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                example.id === activeId
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              <example.icon className="size-4" />
              {example.label}
            </button>
          ))}
        </div>

        <div className="mx-auto mt-8 max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/5">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
            <p className="text-xs font-medium text-muted-foreground">Nexo · {active.label}</p>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              Ejemplo
            </span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-3 p-5"
            >
              {active.exchange.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "customer" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      msg.role === "customer" ? "bg-muted text-foreground" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Cada negocio entrena a su propio Nexo — las respuestas reales dependen de la información que
          vos le cuentes.
        </p>
      </div>
    </section>
  );
}
