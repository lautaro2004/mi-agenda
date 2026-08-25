import { ArrowRight, Clock, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BookingTrigger } from "@/components/public-site/booking/booking-trigger";
import { formatPrice } from "@/lib/currency";
import type { Service } from "@/lib/types";

interface BookingServicesSectionProps {
  services: Service[];
  whatsappHref: string | null;
}

// Cards de servicio + CTA que abren el modal de reserva compartido
// (BookingModal, ver booking-modal-context.tsx) — reemplaza al widget
// embebido que vivía acá mismo (sección "Elegí fecha y horario") para que la
// landing quede enfocada en mostrar el negocio, no en ser la pantalla de
// reserva. Server Component: BookingTrigger es el único pedazo interactivo,
// ya es "use client" por su cuenta.
export function BookingServicesSection({ services, whatsappHref }: BookingServicesSectionProps) {
  return (
    <section id="servicios" className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
      <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        Elegí qué reservar
      </h2>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <div
            key={service.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-sm"
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-muted">
              {service.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={service.imageUrl} alt={service.name} className="size-full object-cover" />
              ) : (
                <div className="flex size-full items-center justify-center bg-[var(--brand-primary,var(--primary))]/10 text-3xl font-semibold text-[var(--brand-primary,var(--primary))]">
                  {service.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col p-5">
              <h3 className="text-base font-semibold text-foreground">{service.name}</h3>
              {service.description && (
                <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
              )}

              <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" />
                  {service.durationMinutes} min
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                {service.price > 0 ? (
                  <span className="text-lg font-semibold text-foreground">{formatPrice(service.price)}</span>
                ) : (
                  <span />
                )}
                <BookingTrigger
                  serviceId={service.id}
                  size="sm"
                  className="bg-[var(--brand-primary,var(--primary))] hover:bg-[var(--brand-primary,var(--primary))]/90"
                >
                  Reservar
                  <ArrowRight className="size-3.5" data-icon="inline-end" />
                </BookingTrigger>
              </div>
            </div>
          </div>
        ))}
      </div>

      {whatsappHref && (
        <div className="mt-10 flex flex-col items-center gap-2.5 text-center">
          <p className="text-sm text-muted-foreground">¿Tenés alguna duda antes de reservar?</p>
          <Button size="sm" variant="outline" render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
            <MessageCircle className="size-3.5" data-icon="inline-start" />
            Hablar por WhatsApp
          </Button>
        </div>
      )}
    </section>
  );
}
