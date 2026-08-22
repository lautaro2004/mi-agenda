"use client";

import { motion } from "framer-motion";
import { Bot, Boxes, Globe, MessageSquareText, Repeat, CalendarCheck2 } from "lucide-react";

const MODULES = [
  {
    icon: Bot,
    title: "IA para tu negocio",
    description: "Un asistente que conoce tus servicios, horarios y la información de tu empresa.",
  },
  {
    icon: MessageSquareText,
    title: "WhatsApp",
    description: "Atendé consultas y guiá a tus clientes desde WhatsApp.",
  },
  {
    icon: Globe,
    title: "Sitio web",
    description: "Tu propio sitio público con la información de tu negocio.",
  },
  {
    icon: CalendarCheck2,
    title: "Reservas",
    description: "Permití que tus clientes consulten disponibilidad y reserven.",
  },
  {
    icon: Boxes,
    title: "Recursos y conocimiento",
    description: "Centralizá documentos, información y conocimiento para que Nexo pueda utilizarlo.",
  },
  {
    icon: Repeat,
    title: "Automatización",
    description: "Dejá que Nexo se encargue de tareas repetitivas y consultas frecuentes.",
  },
];

export function LandingKnowsYourBusiness() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Todo tu negocio, conectado
          </h2>
          <p className="mt-4 text-muted-foreground">
            La agenda y las reservas son una parte de lo que hace Nexo — no todo el producto.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module, index) => (
            <motion.div
              key={module.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-6"
            >
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <module.icon className="size-5" />
              </div>
              <h3 className="text-base font-semibold text-foreground">{module.title}</h3>
              <p className="text-sm text-muted-foreground">{module.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
