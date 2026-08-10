import Link from "next/link";
import { ArrowRight, Clock, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildWhatsappHref } from "@/lib/whatsapp-link";
import { isBookableService, type Service } from "@/lib/types";

interface ServicesSectionProps {
  services: Service[];
  slug: string;
  whatsappNumber: string | null;
}

const currencyFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function ServicesSection({ services, slug, whatsappNumber }: ServicesSectionProps) {
  if (services.length === 0) return null;

  return (
    <section id="servicios" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-xl text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Servicios</h2>
        <p className="mt-2.5 text-sm text-muted-foreground">
          Información clara sobre cada servicio: qué incluye, precio y cómo avanzar.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const bookable = isBookableService(service);
          // Consultar por WhatsApp lleva el mensaje ya contextualizado al
          // servicio puntual — no un link genérico igual para todos.
          const consultHref = buildWhatsappHref(
            whatsappNumber,
            `Hola, vi el servicio de ${service.name} y me gustaría consultar por un proyecto.`
          );

          return (
            <div
              key={service.id}
              className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-[var(--brand-primary,var(--primary))]/40 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground">{service.name}</h3>
              </div>

              {service.description && (
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
              )}

              <div className="mt-4 flex items-center gap-3 text-sm">
                {service.price > 0 && (
                  <span className="font-semibold text-foreground">
                    {bookable ? "" : "Desde "}
                    {currencyFormatter.format(service.price)}
                  </span>
                )}
                {/* durationMinutes solo se muestra cuando el servicio es
                    realmente reservable por turno — ver isBookableService().
                    Si el plazo real es "1 semana", eso ya vive en la
                    description de arriba, no acá. */}
                {bookable && (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3.5" />
                    {service.durationMinutes} min
                  </span>
                )}
              </div>

              <div className="mt-5 border-t border-border pt-4">
                {bookable ? (
                  <Button
                    size="sm"
                    className="w-full bg-[var(--brand-primary,var(--primary))] hover:bg-[var(--brand-primary,var(--primary))]/90"
                    render={<Link href={`/s/${slug}/reservar?servicio=${service.id}`} />}
                    nativeButton={false}
                  >
                    Reservar turno
                    <ArrowRight className="size-3.5" data-icon="inline-end" />
                  </Button>
                ) : consultHref ? (
                  <Button size="sm" variant="outline" className="w-full" render={<a href={consultHref} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
                    <MessageCircle className="size-3.5" data-icon="inline-start" />
                    Consultar
                    <ArrowRight className="size-3.5" data-icon="inline-end" />
                  </Button>
                ) : (
                  // Sin WhatsApp configurado no hay a dónde mandar la
                  // consulta — mejor no mostrar un botón roto.
                  <p className="text-center text-xs text-muted-foreground">Consultanos por este servicio</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
