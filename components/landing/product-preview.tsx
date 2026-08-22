"use client";

import { motion } from "framer-motion";
import { CalendarClock, MessageCircle, Palette } from "lucide-react";

const SERVICES = [
  { name: "Corte de cabello", price: "$4.500" },
  { name: "Coloración", price: "$12.000" },
  { name: "Arreglo de barba", price: "$3.000" },
];

const HIGHLIGHTS = [
  { icon: Palette, label: "Identidad visual", description: "Logo, colores e imagen de encabezado propios." },
  { icon: CalendarClock, label: "Horarios y FAQs", description: "Siempre al día con la información real del negocio." },
  { icon: MessageCircle, label: "WhatsApp directo", description: "Un botón que lleva la conversación al asistente." },
];

// Sección 9: cada negocio tiene su propio sitio público (/s/[slug]), armado
// automáticamente con su información real — nunca se usa la palabra
// "builder": la propuesta es que Nexo arma la experiencia, no que el dueño
// diseña desde cero.
export function LandingProductPreview() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-primary">Presencia online</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
              Tu negocio también tiene su propio espacio en la web
            </h2>
            <p className="mt-5 text-muted-foreground">
              Sin diseñar desde cero. Nexo arma la experiencia por vos: logo, información del
              negocio, servicios, horarios, preguntas frecuentes y reservas cuando corresponda —
              todo en una página lista para compartir.
            </p>

            <div className="mt-8 space-y-4">
              {HIGHLIGHTS.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.4, delay: index * 0.06 }}
                  className="flex items-start gap-3"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/5"
          >
            <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
              <span className="size-3 rounded-full bg-destructive/60" />
              <span className="size-3 rounded-full bg-yellow-400/70" />
              <span className="size-3 rounded-full bg-emerald-400/70" />
              <span className="ml-3 text-xs text-muted-foreground">tunegocio.nexo.ar</span>
            </div>

            <div className="h-20 bg-gradient-to-br from-primary/25 to-primary/5" />

            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
                B
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Barbería del Centro</p>
                <p className="text-xs text-muted-foreground">Cortes, color y barba</p>
              </div>
            </div>

            <div className="space-y-2 px-5 py-4">
              <p className="text-xs font-medium text-muted-foreground">Servicios</p>
              {SERVICES.map((service) => (
                <div key={service.name} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                  <span className="text-sm text-foreground">{service.name}</span>
                  <span className="text-sm font-medium text-foreground">{service.price}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-border px-5 py-4">
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white"
              >
                <MessageCircle className="size-4" />
                Hablar por WhatsApp
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
