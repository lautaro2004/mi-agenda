"use client";

import { motion } from "framer-motion";

const AUDIENCE = [
  "Pymes",
  "Emprendimientos",
  "Profesionales independientes",
  "Negocios con reservas",
  "Empresas de servicios",
  "Equipos pequeños",
];

export function LandingAudience() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          Pensado para negocios que quieren trabajar mejor
        </h2>
        <p className="mt-4 text-muted-foreground">
          No importa el rubro — si atendés clientes y respondés las mismas consultas todos los días,
          Nexo te sirve.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
          {AUDIENCE.map((item, index) => (
            <motion.span
              key={item}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.35, delay: index * 0.05 }}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground"
            >
              {item}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}
