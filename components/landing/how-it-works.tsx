"use client";

import { motion } from "framer-motion";
import { Building2, CalendarDays, ListChecks, MessageCircleQuestion, Rocket } from "lucide-react";

const steps = [
  {
    icon: Building2,
    title: "Contanos sobre tu negocio",
    description: "Nombre, logo, rubro y una breve descripción para presentarte a tus clientes.",
  },
  {
    icon: CalendarDays,
    title: "Definí tus horarios",
    description: "Elegí los días y horarios en los que tu negocio atiende.",
  },
  {
    icon: ListChecks,
    title: "Cargá tus servicios",
    description: "Agregá cada servicio con su duración y precio.",
  },
  {
    icon: MessageCircleQuestion,
    title: "Sumá preguntas frecuentes",
    description: "Anticipate a las dudas más comunes de tus clientes.",
  },
  {
    icon: Rocket,
    title: "Activá tu suscripción",
    description: "Elegí tu plan y quedá listo para conectar WhatsApp.",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="como-funciona" className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Cómo funciona
          </h2>
          <p className="mt-4 text-muted-foreground">
            Un asistente de configuración te acompaña paso a paso para que tu
            negocio quede listo en minutos.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-5">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.06 }}
              className="flex flex-col gap-4 bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="size-5" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
