import Link from "next/link";
import { MessageCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";

const highlights = [
  {
    icon: Sparkles,
    title: "Configuración guiada",
    description: "Un asistente paso a paso te ayuda a dejar tu negocio listo en minutos.",
  },
  {
    icon: Zap,
    title: "Resultados inmediatos",
    description: "Definí servicios, horarios y preguntas frecuentes sin complicaciones.",
  },
  {
    icon: ShieldCheck,
    title: "Tus datos, seguros",
    description: "La información de tu negocio está protegida y aislada del resto.",
  },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen flex-1 lg:grid-cols-2">
      <div className="flex flex-col justify-center px-4 py-12 sm:px-6 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2 font-semibold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageCircle className="size-4" />
            </span>
            <span>Mi Agenda</span>
          </Link>
          {children}
        </div>
      </div>

      <div className="relative hidden flex-col justify-center overflow-hidden bg-muted/40 px-16 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/15 via-transparent to-transparent"
          aria-hidden
        />
        <div className="max-w-md">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Todo listo para automatizar tu atención
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            En pocos minutos vas a tener tu negocio configurado y preparado
            para conectar WhatsApp.
          </p>

          <div className="mt-10 space-y-6">
            {highlights.map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
