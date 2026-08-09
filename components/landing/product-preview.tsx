"use client";

import { motion } from "framer-motion";
import { Bot, CalendarCheck, MessageSquare, Settings2 } from "lucide-react";

import { ComingSoonBadge } from "@/components/dashboard/coming-soon-badge";
import {
  previewAiActivity,
  previewAppointments,
  previewConversations,
} from "@/lib/mock-data";

const previews = [
  {
    icon: MessageSquare,
    title: "Conversaciones",
    description: "Todos tus chats de WhatsApp en un solo lugar.",
    comingSoon: true,
    content: (
      <div className="flex flex-col gap-2.5">
        {previewConversations.map((conversation) => (
          <div
            key={conversation.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{conversation.name}</p>
              <p className="truncate text-xs text-muted-foreground">{conversation.message}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{conversation.time}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: CalendarCheck,
    title: "Turnos",
    description: "Cada reserva organizada automáticamente en tu agenda.",
    comingSoon: true,
    content: (
      <div className="flex flex-col gap-2.5">
        {previewAppointments.map((appointment) => (
          <div
            key={appointment.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{appointment.client}</p>
              <p className="truncate text-xs text-muted-foreground">{appointment.service}</p>
            </div>
            <span className="shrink-0 text-xs font-medium text-foreground">{appointment.time}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Settings2,
    title: "Configuración del negocio",
    description: "Servicios, horarios y datos de contacto siempre al día.",
    comingSoon: false,
    content: (
      <div className="flex flex-col gap-2.5">
        {[
          { label: "Servicios activos", value: "6" },
          { label: "Horarios configurados", value: "7 / 7 días" },
          { label: "Preguntas frecuentes", value: "4" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2"
          >
            <span className="text-sm text-muted-foreground">{item.label}</span>
            <span className="text-sm font-medium text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Bot,
    title: "Asistente con IA",
    description: "Resúmenes y sugerencias automáticas para tu negocio.",
    comingSoon: true,
    content: (
      <div className="flex flex-col gap-2.5">
        {previewAiActivity.map((activity) => (
          <div key={activity.id} className="rounded-xl border border-border/60 bg-card px-3 py-2">
            <p className="text-sm font-medium text-foreground">{activity.title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{activity.detail}</p>
          </div>
        ))}
      </div>
    ),
  },
];

export function LandingProductPreview() {
  return (
    <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Tu negocio, de un vistazo
          </h2>
          <p className="mt-4 text-muted-foreground">
            Así se ve tu panel de control. Algunas funciones llegan en los
            próximos módulos, pero la base ya está lista.
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-2">
          {previews.map((preview, index) => (
            <motion.div
              key={preview.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="relative overflow-hidden rounded-2xl border border-border bg-card p-5"
            >
              {preview.comingSoon && (
                <div className="pointer-events-none absolute inset-0 bg-background/55 backdrop-blur-[2px]" />
              )}
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <preview.icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{preview.title}</h3>
                    <p className="text-xs text-muted-foreground">{preview.description}</p>
                  </div>
                </div>
                {preview.comingSoon && <ComingSoonBadge />}
              </div>
              <div className="relative mt-4">{preview.content}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
