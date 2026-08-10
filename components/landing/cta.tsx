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
        className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card px-8 py-16 text-center sm:px-16"
      >
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
          Tu negocio sigue funcionando
          <br />
          aunque vos estés ocupado.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Configurá tu asistente, conectá WhatsApp y dejá que Mi Agenda se encargue de las
          consultas y las reservas.
        </p>
        <div className="mt-8 flex justify-center">
          <Button size="lg" className="h-11 px-6 text-base" render={<Link href="/registro" />} nativeButton={false}>
            Crear mi asistente
            <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
          </Button>
        </div>
      </motion.div>
    </section>
  );
}
