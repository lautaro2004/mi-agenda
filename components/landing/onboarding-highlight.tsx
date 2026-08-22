"use client";

import { motion } from "framer-motion";

const EXCHANGE = [
  { role: "ai" as const, text: "¿Qué servicios ofrecen?" },
  { role: "owner" as const, text: "Desarrollo web, mantenimiento y soluciones digitales." },
  { role: "ai" as const, text: "Perfecto. ¿Querés contarme ahora cómo trabajan con los clientes?" },
];

// Refuerzo corto y contundente del diferencial ya presentado en la sección
// 4 — acá el objetivo es una sola idea, justo antes de precios: hablar con
// Nexo ES configurar Nexo.
export function LandingOnboardingHighlight() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
              No necesitás pasar horas configurando tu negocio.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Nexo te pregunta, entiende tus respuestas y transforma esa información en la
              configuración de tu negocio.
            </p>
            <p className="mt-4 text-base font-medium text-foreground">
              Hablar con Nexo <span className="text-primary">es</span> configurar Nexo.
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-lg shadow-primary/5"
          >
            {EXCHANGE.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "owner" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    msg.role === "owner" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
