"use client";

import * as React from "react";
import { ArrowRight, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BookingWidget } from "@/components/public-site/booking-widget";
import { formatPrice } from "@/lib/currency";
import type { Service } from "@/lib/types";

interface BookingPageClientProps {
  slug: string;
  services: Service[];
  business: BookingWidgetProps["business"];
  whatsappHref: string | null;
  initialServiceId?: string;
}

type BookingWidgetProps = React.ComponentProps<typeof BookingWidget>;

// Cards de servicio + widget de reserva embebido, coordinados por un mismo
// estado de selección — client component porque "reservar" en una card debe
// preseleccionar el servicio en el widget de abajo Y scrollear hasta él, sin
// navegar a otra página (sección 4/10 de la tarea: reserva embebida, no un
// segundo click-through). El widget en sí es el mismo BookingWidget de
// siempre (misma disponibilidad, mismo endpoint) — remonta con "key" cuando
// cambia la selección porque useForm solo lee defaultValues una vez.
export function BookingPageClient({ slug, services, business, whatsappHref, initialServiceId }: BookingPageClientProps) {
  const [selectedServiceId, setSelectedServiceId] = React.useState<string | undefined>(initialServiceId);

  function handleReserve(serviceId: string) {
    setSelectedServiceId(serviceId);
    document.getElementById("reservar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
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
                  <Button
                    size="sm"
                    className="bg-[var(--brand-primary,var(--primary))] hover:bg-[var(--brand-primary,var(--primary))]/90"
                    onClick={() => handleReserve(service.id)}
                  >
                    Reservar
                    <ArrowRight className="size-3.5" data-icon="inline-end" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="reservar" className="mx-auto max-w-lg px-4 pb-16 sm:px-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Elegí fecha y horario
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Reservá en menos de un minuto. La disponibilidad es en tiempo real.
        </p>
        <div className="mt-7">
          <BookingWidget
            key={selectedServiceId}
            slug={slug}
            services={services}
            business={business}
            whatsappHref={whatsappHref}
            initialServiceId={selectedServiceId}
          />
        </div>
      </section>
    </>
  );
}
