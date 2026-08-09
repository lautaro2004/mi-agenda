"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LandingHero() {
  return (
    <section className="relative overflow-hidden px-4 pt-20 pb-24 sm:px-6 sm:pt-28 sm:pb-32 lg:px-8">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[500px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent"
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
          Tu WhatsApp, ahora con superpoderes
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl"
        >
          Convertí tu WhatsApp en
          <br />
          un{" "}
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            asistente
          </span>{" "}
          para tu negocio
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg"
        >
          Respondé consultas, agendá turnos y atendé a tus clientes incluso
          fuera de horario. Mi Agenda organiza tu negocio para que dejes de
          perder tiempo (y clientes) en el chat.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <Button size="lg" className="h-11 px-6 text-base" render={<Link href="/registro" />} nativeButton={false}>
            Crear mi cuenta
            <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
          </Button>
          <a
            href="#por-que-mi-agenda"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver qué incluye
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
        >
          {[
            "Sin tarjeta para empezar",
            "Configuración en minutos",
            "Listo para WhatsApp",
          ].map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-primary" />
              {item}
            </span>
          ))}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
        className="mx-auto mt-16 max-w-5xl"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/5">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <span className="size-3 rounded-full bg-destructive/60" />
            <span className="size-3 rounded-full bg-yellow-400/70" />
            <span className="size-3 rounded-full bg-emerald-400/70" />
            <span className="ml-3 text-xs text-muted-foreground">
              app.miagenda.com/dashboard
            </span>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
            {[
              { label: "Estado de la cuenta", value: "Activa", accent: true },
              { label: "Servicios configurados", value: "6" },
              { label: "Configuración", value: "100%" },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl border border-border bg-background p-5 text-left"
              >
                <p className="text-xs font-medium text-muted-foreground">
                  {card.label}
                </p>
                <p
                  className={`mt-2 text-2xl font-semibold ${
                    card.accent ? "text-primary" : "text-foreground"
                  }`}
                >
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
