"use client";

import { motion } from "framer-motion";
import { MessageCircleWarning } from "lucide-react";

// Sección 2 del pedido: breve a propósito ("no hacer una sección demasiado
// extensa") — un solo párrafo, sin lista de funcionalidades.
export function LandingAdsProblem() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center"
      >
        <span className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <MessageCircleWarning className="size-5" />
        </span>
        <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          ¿Seguís gestionando todo por mensajes?
        </h2>
        <p className="text-muted-foreground">
          Consultas, reservas, horarios y clientes terminan mezclados entre conversaciones — y algo
          siempre se termina perdiendo.
        </p>
      </motion.div>
    </section>
  );
}
