"use client";

import { motion } from "framer-motion";
import { Bot, CalendarCheck, MessageSquare, Settings2 } from "lucide-react";

import { previewAiActivity, previewAppointments, previewConversations } from "@/lib/mock-data";

const panels = [
  {
    icon: MessageSquare,
    title: "Conversaciones",
    description: "Todos tus chats de WhatsApp en un solo lugar.",
    content: (
      <div className="flex flex-col gap-2">
        {previewConversations.map((conversation) => (
          <div
            key={conversation.id}
            className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2"
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
    description: "Reservas por WhatsApp y agendadas a mano, en la misma agenda.",
    content: (
      <div className="flex flex-col gap-2">
        {previewAppointments.map((appointment) => (
          <div
            key={appointment.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2"
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
    description: "Servicios, horarios, FAQs y recursos siempre al día.",
    content: (
      <div className="flex flex-col gap-2">
        {[
          { label: "Servicios activos", value: "6" },
          { label: "Horarios configurados", value: "6 / 7 días" },
          { label: "Preguntas frecuentes", value: "9" },
          { label: "Recursos", value: "3" },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background px-3 py-2"
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
    title: "Tu asistente",
    description: "Entrenamiento, memoria y actividad reciente de la IA.",
    content: (
      <div className="flex flex-col gap-2">
        {previewAiActivity.map((activity) => (
          <div key={activity.id} className="rounded-lg border border-border/60 bg-background px-3 py-2">
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
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Todo tu negocio, de un vistazo
          </h2>
          <p className="mt-4 text-muted-foreground">
            Detrás del asistente hay una plataforma completa para administrarlo — no solo un chat.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mt-14 overflow-hidden rounded-2xl border border-border bg-card shadow-xl shadow-primary/5"
        >
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <span className="size-3 rounded-full bg-destructive/60" />
            <span className="size-3 rounded-full bg-yellow-400/70" />
            <span className="size-3 rounded-full bg-emerald-400/70" />
            <span className="ml-3 text-xs text-muted-foreground">app.miagenda.com/dashboard</span>
          </div>

          <div className="grid gap-px bg-border sm:grid-cols-2">
            {panels.map((panel) => (
              <div key={panel.title} className="bg-card p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <panel.icon className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{panel.title}</h3>
                    <p className="text-xs text-muted-foreground">{panel.description}</p>
                  </div>
                </div>
                <div className="mt-4">{panel.content}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
