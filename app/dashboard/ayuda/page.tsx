import Link from "next/link";
import { Bot, GraduationCap, MessageSquare, Store } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";

const TOPICS = [
  {
    icon: Store,
    title: "Configurar tu negocio",
    description: "Nombre, rubro, descripción, horarios y datos de contacto.",
    href: "/dashboard/negocio",
  },
  {
    icon: GraduationCap,
    title: "Entrenar a tu asistente",
    description: "Contale a la IA cómo funciona tu negocio charlando con ella.",
    href: "/dashboard/ai-studio/training",
  },
  {
    icon: MessageSquare,
    title: "Conectar WhatsApp",
    description: "Vinculá tu número para que el asistente atienda automáticamente.",
    href: "/dashboard/whatsapp/conexion",
  },
  {
    icon: Bot,
    title: "Probar las respuestas antes de publicar",
    description: "Simulá una conversación con tu asistente sin exponerla a clientes reales.",
    href: "/dashboard/ai-studio/simulator",
  },
] as const;

// Guía de autoservicio, sin canal de soporte inventado — todavía no existe
// un email/WhatsApp de soporte configurado en el producto, así que esta
// pantalla solo apunta a las secciones reales que ya resuelven las dudas
// más comunes en vez de simular un canal de contacto que no está.
export default function HelpPage() {
  return (
    <div>
      <PageHeader title="Ayuda" description="Guías rápidas para las tareas más comunes." />

      <div className="grid gap-4 sm:grid-cols-2">
        {TOPICS.map((topic) => (
          <Link
            key={topic.href}
            href={topic.href}
            className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/30"
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <topic.icon className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{topic.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{topic.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
