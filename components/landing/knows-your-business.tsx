"use client";

import { motion } from "framer-motion";
import { Bot, Boxes, Globe, Images, MessageSquareText, QrCode, ScrollText, CalendarCheck2 } from "lucide-react";

// Ecosistema completo — la sección muestra qué puede llegar a tener un negocio
// con Nexo, y el tag aclara desde qué plan comercial (Esencial: agenda + web;
// Profesional: + WhatsApp/IA). Los tags reflejan los gates reales de Plan
// (publicWebEnabled, whatsappEnabled, galleryEnabled,
// digitalMenuEnabled — ver modules/billing/subscription.ts), no una promesa
// aparte del pricing.
const MODULES = [
  {
    icon: Globe,
    title: "Sitio web",
    description: "Tu propio sitio público con la información de tu negocio.",
    tag: "Desde Esencial",
  },
  {
    icon: CalendarCheck2,
    title: "Reservas",
    description: "Tus clientes consultan disponibilidad y reservan desde tu sitio.",
    tag: "Desde Esencial",
  },
  {
    icon: Bot,
    title: "Asistente IA",
    description: "Conoce tus servicios, horarios y la información de tu negocio.",
    tag: "Desde Profesional",
  },
  {
    icon: MessageSquareText,
    title: "WhatsApp con IA",
    description: "Atendé consultas y confirmá reservas automáticamente desde WhatsApp.",
    tag: "Desde Esencial",
  },
  {
    icon: Images,
    title: "Fotos y contenido",
    description: "Una galería con imágenes de tu local, productos o equipo.",
    tag: "Desde Esencial",
  },
  {
    icon: ScrollText,
    title: "Carta digital",
    description: "Subí tu carta en PDF y Nexo genera una página lista para compartir.",
    tag: "Desde Profesional",
  },
  {
    icon: QrCode,
    title: "QR para tus mesas",
    description: "Un código que siempre apunta a la última versión de tu carta.",
    tag: "Desde Profesional",
  },
  {
    icon: Boxes,
    title: "Recursos y conocimiento",
    description: "Centralizá documentos e información para que Nexo pueda utilizarlos.",
    tag: "Desde Profesional",
  },
];

export function LandingKnowsYourBusiness() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Todo tu negocio, en un solo lugar
          </h2>
          <p className="mt-4 text-muted-foreground">
            Sitio, reservas, WhatsApp, IA y contenido digital — cada plan incluye una combinación distinta.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((module, index) => (
            <motion.div
              key={module.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <module.icon className="size-5" />
                </div>
                <span className="rounded-full border border-border bg-background px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {module.tag}
                </span>
              </div>
              <h3 className="text-base font-semibold text-foreground">{module.title}</h3>
              <p className="text-sm text-muted-foreground">{module.description}</p>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <a href="#planes" className="font-medium text-primary hover:underline">
            Mirá el detalle de cada plan
          </a>{" "}
          más abajo.
        </p>
      </div>
    </section>
  );
}
