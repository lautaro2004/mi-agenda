"use client";

import { motion } from "framer-motion";
import { ShieldCheck } from "lucide-react";

// Sección 6 del pedido: breve, sin inventar testimonios/métricas/cantidad de
// clientes. El Andén (mostrado en las secciones 1 y 4) es un negocio real
// que ya usa Nexo para gestionar sus reservas — se lo nombra tal cual, sin
// sumarle una cifra de "clientes" ni un resultado que no se pueda demostrar.
export function LandingAdsTrust() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex max-w-2xl flex-col items-center gap-3 text-center"
      >
        <span className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <p className="text-lg font-medium text-foreground">
          Nexo ya gestiona el día a día de negocios reales, como El Andén.
        </p>
        <p className="text-sm text-muted-foreground">Su sitio y sus reservas funcionan con Nexo, hoy.</p>
      </motion.div>
    </section>
  );
}
