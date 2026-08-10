"use client";

import { motion } from "framer-motion";
import { Eye, FlaskConical, ShieldCheck, ThumbsDown, ThumbsUp } from "lucide-react";

const EXCHANGE = [
  { role: "customer" as const, text: "¿Hacen envíos a domicilio?" },
  { role: "ai" as const, text: "No ofrecemos envíos, pero podés retirar en el local de lunes a sábado." },
];

const TRUST_POINTS = [
  { icon: Eye, label: "Control" },
  { icon: ShieldCheck, label: "Confianza" },
  { icon: FlaskConical, label: "Transparencia" },
];

export function LandingSimulatorShowcase() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/5"
          >
            <div className="flex items-center justify-between border-b border-border bg-muted/40 px-5 py-3">
              <p className="text-xs font-medium text-muted-foreground">Simulador</p>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                Modo prueba
              </span>
            </div>
            <div className="flex flex-col gap-3 p-5">
              {EXCHANGE.map((msg, i) => (
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
              <div className="flex items-center gap-2 self-end text-muted-foreground">
                <button className="rounded-md p-1 hover:bg-muted" aria-label="Respuesta correcta">
                  <ThumbsUp className="size-3.5" />
                </button>
                <button className="rounded-md p-1 hover:bg-muted" aria-label="Corregir respuesta">
                  <ThumbsDown className="size-3.5" />
                </button>
              </div>
            </div>
          </motion.div>

          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
              Probalo antes de hablar con tus clientes
            </h2>
            <p className="mt-5 text-muted-foreground">
              Conversá con tu asistente como si fueras un cliente y verificá cómo responde antes
              de ponerlo en producción. Si algo no está bien, lo corregís ahí mismo.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {TRUST_POINTS.map((point) => (
                <span
                  key={point.label}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground"
                >
                  <point.icon className="size-4 text-primary" />
                  {point.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
