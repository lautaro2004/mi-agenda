import { ArrowRight, Clock, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BookingTrigger } from "@/components/public-site/booking/booking-trigger";
import { formatPrice } from "@/lib/currency";
import type { Service } from "@/lib/types";

interface BookingServicesSectionProps {
  services: Service[];
  whatsappHref: string | null;
}

const BRAND = "var(--brand-primary,var(--primary))";

// Agrupa por la categoría que YA tiene cada servicio (texto libre). Solo se
// agrupa cuando hay más de una categoría real; si no, es una grilla simple.
// Conserva el orden de aparición, no inventa categorías.
function groupByCategory(services: Service[]): { name: string; items: Service[] }[] {
  const map = new Map<string, Service[]>();
  for (const service of services) {
    const key = service.category?.trim() ?? "";
    map.set(key, [...(map.get(key) ?? []), service]);
  }
  return [...map.entries()].map(([name, items]) => ({ name, items }));
}

function categoryAnchor(name: string, index: number): string {
  const slug = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `cat-${slug || index}`;
}

function ServiceCard({ service }: { service: Service }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xs motion-safe:transition-shadow hover:shadow-md">
      <div className="aspect-[5/4] w-full overflow-hidden bg-muted">
        {service.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={service.imageUrl}
            alt={service.name}
            loading="lazy"
            className="size-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-muted/60">
            <span
              aria-hidden
              className="flex size-14 items-center justify-center rounded-2xl text-xl font-semibold text-primary-foreground"
              style={{ background: BRAND }}
            >
              {service.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold tracking-tight text-foreground">{service.name}</h3>
          {service.price > 0 && <span className="shrink-0 text-base font-semibold text-foreground">{formatPrice(service.price)}</span>}
        </div>
        {service.description && (
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{service.description}</p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            {service.durationMinutes} min
          </span>
          <BookingTrigger
            serviceId={service.id}
            size="sm"
            aria-label={`Reservar ${service.name}`}
            className="h-10 px-4 text-primary-foreground hover:opacity-90"
            style={{ background: BRAND }}
          >
            Reservar
            <ArrowRight className="size-3.5" data-icon="inline-end" />
          </BookingTrigger>
        </div>
      </div>
    </article>
  );
}

// Cards de servicio + CTA que abren el modal de reserva compartido
// (BookingModal, ver booking-modal-context.tsx). Server Component:
// BookingTrigger es el único pedazo interactivo. Precios y duraciones salen
// del servicio tal cual; el precio no se muestra si no está configurado.
export function BookingServicesSection({ services, whatsappHref }: BookingServicesSectionProps) {
  const groups = groupByCategory(services);
  const grouped = groups.length > 1;

  return (
    <section id="servicios" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Servicios</h2>
        <p className="mt-3 text-base text-muted-foreground">Elegí lo que necesitás y reservá tu horario en pocos pasos.</p>
      </div>

      {grouped && (
        <nav aria-label="Categorías de servicios" className="-mx-4 mt-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {groups.map((group, index) => (
            <a
              key={group.name || index}
              href={`#${categoryAnchor(group.name, index)}`}
              className="shrink-0 rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-safe:transition-colors"
            >
              {group.name || "Otros"}
            </a>
          ))}
        </nav>
      )}

      <div className="mt-10 space-y-14">
        {groups.map((group, index) => (
          <div key={group.name || index} id={grouped ? categoryAnchor(group.name, index) : undefined} className="scroll-mt-24">
            {grouped && <h3 className="mb-5 text-lg font-semibold tracking-tight text-foreground">{group.name || "Otros"}</h3>}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {whatsappHref && (
        <div className="mt-14 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">¿Tenés alguna duda antes de reservar?</p>
          <Button size="sm" variant="outline" render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
            <MessageCircle className="size-3.5" data-icon="inline-start" />
            Escribinos por WhatsApp
          </Button>
        </div>
      )}
    </section>
  );
}
