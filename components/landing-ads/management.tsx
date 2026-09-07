"use client";

import { motion } from "framer-motion";
import { BarChart3, CalendarCheck2, CalendarClock, ListChecks, MessageSquare, Store } from "lucide-react";

// Sección 5 del pedido: la interfaz real del dashboard de Nexo. A
// diferencia de las secciones 1/4 (que usan datos reales de El Andén, un
// negocio público), acá se arma un mockup con contenido ilustrativo — el
// dashboard real requiere sesión y muestra datos operativos privados del
// negocio (turnos, conversaciones de WhatsApp), que no corresponde exponer
// a una visita anónima. La estructura sí es la real: mismos 6 ítems, mismos
// íconos que components/dashboard/sidebar-nav.tsx (lib/dashboard-nav.ts) —
// nunca se inventa una navegación distinta a la que el producto tiene hoy.
const NAV_ITEMS = [
  { label: "Servicios", icon: ListChecks },
  { label: "Horarios", icon: CalendarClock },
  { label: "Turnos", icon: CalendarCheck2 },
  { label: "WhatsApp", icon: MessageSquare },
  { label: "Estadísticas", icon: BarChart3 },
  { label: "Negocio", icon: Store },
] as const;

const TODAY_APPOINTMENTS = [
  { time: "10:00", client: "Cliente", service: "Servicio reservado" },
  { time: "14:30", client: "Cliente", service: "Servicio reservado" },
  { time: "18:00", client: "Cliente", service: "Servicio reservado" },
];

export function LandingAdsManagement() {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Y vos lo gestionás desde un solo lugar.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Servicios, horarios, turnos, WhatsApp, estadísticas y la configuración de tu negocio — todo
            junto, sin planillas sueltas.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-12 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10"
        >
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
            <span className="size-3 rounded-full bg-destructive/60" />
            <span className="size-3 rounded-full bg-yellow-400/70" />
            <span className="size-3 rounded-full bg-emerald-400/70" />
            <span className="ml-3 text-xs text-muted-foreground">nexo.app/dashboard</span>
          </div>

          <div className="flex flex-col sm:flex-row">
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-3 sm:w-52 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0 sm:p-4">
              {NAV_ITEMS.map((item, index) => (
                <div
                  key={item.label}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                    index === 2 ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="size-4 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </div>
              ))}
            </div>

            <div className="flex-1 p-4 sm:p-6">
              <p className="text-xs font-medium text-muted-foreground">Turnos de hoy</p>
              <div className="mt-3 space-y-2">
                {TODAY_APPOINTMENTS.map((appt) => (
                  <div
                    key={appt.time}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm"
                  >
                    <span className="font-medium text-foreground">{appt.time}</span>
                    <span className="text-muted-foreground">{appt.service}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
