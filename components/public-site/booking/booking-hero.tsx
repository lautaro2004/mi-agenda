import { ArrowRight, MapPin, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BookingTrigger } from "@/components/public-site/booking/booking-trigger";
import type { Business } from "@/lib/types";

interface BookingHeroProps {
  business: Business;
  whatsappHref: string | null;
  heroImageUrl: string | null;
  // Igual criterio que HeroBookingCard (components/public-site/hero-booking-card.tsx):
  // nunca se nombra el tipo de recurso ("cancha", "sala") — viene de
  // getActiveServiceResources(), no de parsear nombres. Solo cambia el
  // copy genérico entre "tu turno" y "tu espacio".
  usesResources: boolean;
}

const BRAND = "var(--brand-primary,var(--primary))";

function Monogram({ business, size }: { business: Business; size: string }) {
  return business.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={business.logoUrl} alt="" className={`${size} rounded-2xl border border-border bg-background object-cover`} />
  ) : (
    <span
      aria-hidden
      className={`${size} flex items-center justify-center rounded-2xl text-primary-foreground`}
      style={{ background: BRAND }}
    >
      <span className="text-3xl font-semibold tracking-tight">{business.name.charAt(0).toUpperCase() || "?"}</span>
    </span>
  );
}

// Portada editorial de la plantilla de reservas. Con foto: la imagen real
// protagoniza, con un degradé solo para asegurar el contraste del texto. Sin
// foto: composición tipográfica neutra con el color de marca (nada de
// imágenes externas obligatorias ni espacios vacíos). Todo el contenido sale
// de la configuración del negocio; el CTA abre el flujo de reserva real.
export function BookingHero({ business, whatsappHref, heroImageUrl, usesResources }: BookingHeroProps) {
  const noun = usesResources ? "espacio" : "turno";
  const description = business.description?.trim() || `Elegí tu ${noun}, fecha y horario y asegurá tu reserva en pocos pasos.`;
  const address = business.address?.trim();
  const hasImage = !!heroImageUrl;

  const actions = (
    <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
      <BookingTrigger
        size="lg"
        className="h-12 px-7 text-base text-primary-foreground shadow-sm hover:opacity-90 motion-safe:transition-opacity"
        style={{ background: BRAND }}
      >
        Reservar turno
        <ArrowRight className="size-4" data-icon="inline-end" />
      </BookingTrigger>
      {whatsappHref && (
        <Button
          size="lg"
          variant={hasImage ? "secondary" : "outline"}
          className="h-12 px-6 text-base"
          render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
          nativeButton={false}
        >
          <MessageCircle className="size-4" data-icon="inline-start" />
          Consultar por WhatsApp
        </Button>
      )}
    </div>
  );

  if (hasImage) {
    return (
      <section className="relative isolate overflow-hidden border-b border-border">
        <div className="relative flex min-h-[520px] items-end sm:min-h-[600px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroImageUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/40 to-black/10" aria-hidden />

          <div className="mx-auto w-full max-w-6xl px-4 pb-12 pt-28 sm:px-6 sm:pb-16">
            <div className="max-w-2xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
              {business.category && (
                <span className="text-xs font-semibold tracking-[0.18em] text-white/85 uppercase">{business.category}</span>
              )}
              <h1 className="mt-3 text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-white sm:text-6xl">
                {business.name}
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">{description}</p>
              {address && (
                <p className="mt-4 inline-flex items-center gap-1.5 text-sm text-white/80">
                  <MapPin className="size-4 shrink-0" aria-hidden />
                  {address}
                </p>
              )}
              {actions}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 opacity-[0.07]" style={{ background: BRAND }} aria-hidden />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.4fr_1fr]">
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
          {business.category && (
            <span className="text-xs font-semibold tracking-[0.18em] uppercase" style={{ color: BRAND }}>
              {business.category}
            </span>
          )}
          <h1 className="mt-3 text-4xl leading-[1.05] font-semibold tracking-tight text-balance text-foreground sm:text-6xl">
            {business.name}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">{description}</p>
          {actions}
        </div>

        <div className="hidden justify-self-end lg:block">
          <div className="flex w-72 flex-col items-start gap-5 rounded-3xl border border-border bg-card p-8 shadow-sm">
            <Monogram business={business} size="size-20" />
            <div>
              <p className="text-lg font-semibold tracking-tight text-foreground">{business.name}</p>
              {address && (
                <p className="mt-2 inline-flex items-start gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {address}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
