import { CalendarCheck2, Clock } from "lucide-react";

import { formatPrice } from "@/lib/currency";
import type { Business, BusinessSchedule, Service } from "@/lib/types";

// Sin "use client": no usa hooks, así que se puede renderizar tanto desde un
// Server Component (app/negocio-online/page.tsx) como desde las secciones
// cliente (hero.tsx/result.tsx) que lo envuelven en motion.div para la
// animación de entrada.
//
// Datos 100% reales de El Andén (negocio real ya usando Nexo, ver
// modules/business/service.ts#getBusinessState) — nunca texto ni precios
// inventados. "variant=compact" (hero, sección 1) solo muestra la imagen +
// nombre; "variant=detailed" (resultado, sección 4) agrega servicios,
// precios, horario y el CTA de reserva, tal como pide el pedido ("destacar
// visualmente: información del negocio, servicios, precios, horarios,
// reservas").
interface SitePreviewMockupProps {
  business: Business;
  services: Service[];
  schedule?: BusinessSchedule;
  slug: string;
  variant?: "compact" | "detailed";
}

export function SitePreviewMockup({ business, services, schedule, slug, variant = "compact" }: SitePreviewMockupProps) {
  const openDay = schedule?.find((d) => d.enabled);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10">
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-3">
        <span className="size-3 rounded-full bg-destructive/60" />
        <span className="size-3 rounded-full bg-yellow-400/70" />
        <span className="size-3 rounded-full bg-emerald-400/70" />
        <span className="ml-3 truncate text-xs text-muted-foreground">nexo.app/s/{slug}</span>
      </div>

      <div className="relative h-40 sm:h-56">
        {business.heroImageUrl ? (
          // Mismo criterio que components/public-site/hero.tsx: sin
          // next/image para no dar de alta el dominio dinámico de Supabase
          // Storage en next.config.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={business.heroImageUrl} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 to-primary/5" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 p-4 sm:p-5">
          {business.logoUrl && (
            <span className="flex size-12 shrink-0 overflow-hidden rounded-xl border-2 border-white/80 bg-white shadow-lg sm:size-14">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={business.logoUrl} alt={business.name} className="size-full object-cover" />
            </span>
          )}
          <div>
            <p className="text-base font-semibold text-white drop-shadow-sm sm:text-lg">{business.name}</p>
            {business.category && <p className="text-xs text-white/85 drop-shadow-sm sm:text-sm">{business.category}</p>}
          </div>
        </div>
      </div>

      {variant === "detailed" && (
        <div className="space-y-4 px-5 py-5">
          {services.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Servicios</p>
              <div className="mt-2 space-y-2">
                {services.map((service) => (
                  <div key={service.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                    <span className="text-sm text-foreground">{service.name}</span>
                    <span className="text-sm font-medium text-foreground">{formatPrice(service.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {openDay && (
            <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">
              <Clock className="size-3.5 shrink-0" />
              Abierto de {openDay.openTime} a {openDay.closeTime}
            </div>
          )}

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <CalendarCheck2 className="size-4" />
            Reservar ahora
          </button>
        </div>
      )}
    </div>
  );
}
