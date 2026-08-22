"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function LandingCta() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border bg-card px-8 py-16 text-center sm:px-16"
      >
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
          Tu negocio ya sabe hacer mucho.
          <br />
          Nexo puede ayudarte a hacerlo más simple.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Configurá tu negocio, conectá tus canales y empezá a trabajar con un asistente que
          entiende cómo funciona tu empresa.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Button size="lg" className="h-11 px-6 text-base" render={<Link href="/registro" />} nativeButton={false}>
            Empezar gratis
            <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
          </Button>
          <a
            href="#producto"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Conocer Nexo
          </a>
        </div>
      </motion.div>
    </section>
  );
}
