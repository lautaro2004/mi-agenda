"use client";

import { motion } from "framer-motion";
import { Banknote, CalendarClock, Info, ListChecks } from "lucide-react";

import { SitePreviewMockup } from "@/components/landing-ads/site-preview-mockup";
import type { Business, BusinessSchedule, Service } from "@/lib/types";

interface LandingAdsResultProps {
  business: Business;
  services: Service[];
  schedule: BusinessSchedule;
  slug: string;
}

const HIGHLIGHTS = [
  { icon: Info, label: "Información del negocio" },
  { icon: ListChecks, label: "Servicios" },
  { icon: Banknote, label: "Precios" },
  { icon: CalendarClock, label: "Horarios y reservas" },
] as const;

// Sección 4 del pedido: la misma web real de El Andén, esta vez en el
// variant "detailed" (servicios + precios + horario + CTA de reserva
// visibles) — el objetivo es que el visitante se imagine su propio negocio
// en el lugar de El Andén.
export function LandingAdsResult({ business, services, schedule, slug }: LandingAdsResultProps) {
  return (
    <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="order-2 lg:order-1"
        >
          <SitePreviewMockup business={business} services={services} schedule={schedule} slug={slug} variant="detailed" />
        </motion.div>

        <div className="order-1 lg:order-2">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Tu propio espacio online
          </h2>
          <p className="mt-4 text-muted-foreground">
            Así se ve el sitio real de {business.name}, armado con Nexo — imaginá el tuyo funcionando
            de la misma forma.
          </p>

          <div className="mt-8 grid grid-cols-2 gap-4">
            {HIGHLIGHTS.map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-4" />
                </span>
                <span className="text-sm font-medium text-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
