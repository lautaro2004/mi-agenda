"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CalendarCheck2, MessageCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

const CHAT_EXCHANGE = [
  { from: "customer" as const, text: "Hola! ¿Tenés disponibilidad para una landing page?" },
  {
    from: "assistant" as const,
    text: "Sí. Hacemos Landing Pages desde USD 250, con entrega en 1 semana aprox. ¿Te cuento cómo arrancamos?",
  },
];

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24 lg:px-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent"
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
          El asistente operativo de tu negocio
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl md:text-6xl"
        >
          Tu negocio atiende.
          <br />
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Mi Agenda
          </span>{" "}
          se encarga del resto.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg"
        >
          Configurá un asistente de IA que conoce tus servicios, precios, horarios y reglas.
          Atiende a tus clientes por WhatsApp y gestiona sus reservas automáticamente.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Button size="lg" className="h-11 px-6 text-base" render={<Link href="/registro" />} nativeButton={false}>
            Crear mi asistente
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
          Configurá tu negocio conversando con la IA. Sin formularios interminables.
        </motion.p>
      </div>

      {/* Visual: negocio -> IA -> cliente, en un solo mockup */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="relative mx-auto mt-16 max-w-5xl"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <span className="size-3 rounded-full bg-destructive/60" />
            <span className="size-3 rounded-full bg-yellow-400/70" />
            <span className="size-3 rounded-full bg-emerald-400/70" />
            <span className="ml-3 text-xs text-muted-foreground">app.miagenda.com/dashboard</span>
          </div>

          <div className="grid sm:grid-cols-[1.1fr_1fr]">
            {/* Panel izquierdo: estado real del negocio */}
            <div className="flex flex-col gap-4 border-b border-border p-6 sm:border-b-0 sm:border-r sm:p-8">
              <p className="text-xs font-medium text-muted-foreground">Tu negocio, configurado</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Servicios", value: "6" },
                  { label: "Preguntas frecuentes", value: "9" },
                  { label: "Días con horario", value: "6 / 7" },
                  { label: "Configuración", value: "100%", accent: true },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border bg-background p-4 text-left">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p
                      className={`mt-1.5 text-xl font-semibold ${item.accent ? "text-primary" : "text-foreground"}`}
                    >
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-1 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-left">
                <CalendarCheck2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Turno reservado automáticamente — Landing Page, mañana 11:00
                </p>
              </div>
            </div>

            {/* Panel derecho: conversación real de WhatsApp */}
            <div className="flex flex-col gap-3 bg-muted/20 p-6 text-left sm:p-8">
              <p className="text-xs font-medium text-muted-foreground">
                <MessageCircle className="mr-1.5 inline size-3.5" />
                WhatsApp del negocio
              </p>
              {CHAT_EXCHANGE.map((msg, i) => (
                <div key={i} className={`flex ${msg.from === "customer" ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                      msg.from === "customer"
                        ? "bg-background text-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card flotante */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
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
