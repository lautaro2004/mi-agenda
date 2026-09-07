"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackEvent } from "@/lib/analytics";

// Sección 7 del pedido: un solo CTA (a diferencia del hero, acá no hay
// secundario) — es el último empujón antes de irse de la página.
export function LandingAdsFinalCta() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-3xl overflow-hidden rounded-3xl border border-border bg-card px-8 py-16 text-center sm:px-16"
      >
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
          Empezá a llevar tu negocio online.
        </h2>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          Creá tu cuenta y empezá a configurar tu negocio con Nexo.
        </p>
        <div className="mt-8 flex justify-center">
          <Button
            size="lg"
            className="h-12 px-7 text-base"
            render={<Link href="/registro" />}
            nativeButton={false}
            onClick={() => trackEvent("click_cta_final", { placement: "final_cta" })}
          >
            Probá Nexo
            <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
