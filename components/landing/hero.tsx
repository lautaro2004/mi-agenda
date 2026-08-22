"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, MessageCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

const CHAT_EXCHANGE = [
  { from: "customer" as const, text: "Hola, ¿tienen disponibilidad mañana para jugar a las 19?" },
  {
    from: "assistant" as const,
    text: "Sí, tenemos disponibilidad a las 19:00. ¿Querés reservar la Cancha 1 o la Cancha 2?",
  },
];

const DETECTED = [
  { label: "Servicio", value: "Fútbol 5" },
  { label: "Horario", value: "19:00" },
  { label: "Recurso", value: "Cancha 2" },
];

// Visual principal del hero: una conversación real con Nexo, no una agenda.
// El objetivo es que se entienda de un vistazo que Nexo entiende el negocio
// y puede actuar (detectar servicio/horario/recurso y confirmar la
// reserva), no que es un calendario con turnos cargados.
export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24 lg:px-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[480px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"
        aria-hidden
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground shadow-sm"
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          NEXO
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl md:text-6xl"
        >
          El asistente inteligente
          <br />
          para tu negocio.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg"
        >
          Nexo aprende cómo funciona tu negocio y te ayuda a atender clientes, gestionar reservas y
          automatizar tareas desde un solo lugar.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Button size="lg" className="h-11 px-6 text-base" render={<Link href="/registro" />} nativeButton={false}>
            Empezar gratis
            <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
          </Button>
          <a
            href="#como-funciona"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver cómo funciona
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.22 }}
          className="mt-5 text-sm text-muted-foreground"
        >
          Configurá tu negocio en minutos. Sin conocimientos técnicos.
        </motion.p>
      </div>

      {/* Visual: Nexo como asistente — conversación real, no una agenda */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="relative mx-auto mt-16 max-w-2xl"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <span className="size-3 rounded-full bg-destructive/60" />
            <span className="size-3 rounded-full bg-yellow-400/70" />
            <span className="size-3 rounded-full bg-emerald-400/70" />
            <span className="ml-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MessageCircle className="size-3.5" />
              Conversación con Nexo
            </span>
          </div>

          <div className="flex flex-col gap-3 p-6 text-left sm:p-8">
            {CHAT_EXCHANGE.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 + i * 0.25 }}
                className={`flex ${msg.from === "customer" ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.from === "customer"
                      ? "bg-muted text-foreground"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {msg.text}
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 1.05 }}
            className="border-t border-border bg-muted/20 px-6 py-4 sm:px-8"
          >
            <div className="flex flex-wrap items-center gap-2">
              {DETECTED.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground"
                >
                  <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                  {item.label}: {item.value}
                </span>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
              <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Reserva confirmada</p>
            </div>
          </motion.div>
        </div>

        {/* Card flotante */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.2 }}
          className="absolute -right-3 -top-5 hidden items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-lg sm:flex"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-xs font-medium text-foreground">Entrenado por su dueño</p>
            <p className="text-[11px] text-muted-foreground">Conversando, sin planillas</p>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
