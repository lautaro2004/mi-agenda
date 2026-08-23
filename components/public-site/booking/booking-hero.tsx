import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
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

// Hero directo para la plantilla de reservas: sin panel abstracto — la
// imagen real del lugar (heroImageUrl) ocupa todo el ancho cuando existe,
// con el CTA de reservar superpuesto. Sin imagen, un fondo de acento simple
// en vez del degradé + grilla de puntos de la institucional (sección 15:
// "evitar hero abstracto cuando existe una imagen real").
export function BookingHero({ business, whatsappHref, heroImageUrl, usesResources }: BookingHeroProps) {
  const noun = usesResources ? "espacio" : "turno";
  const title = `Reservá tu ${noun} en ${business.name}`;

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="relative flex min-h-[420px] items-end sm:min-h-[480px]">
        {heroImageUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImageUrl} alt="" className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" aria-hidden />
          </>
        ) : (
          <div
            className="absolute inset-0 bg-[var(--brand-primary,var(--primary))]/10"
            aria-hidden
          />
        )}

        <div className="relative mx-auto w-full max-w-4xl px-4 py-10 text-center sm:px-6 sm:py-14">
          <span
            className={
              heroImageUrl
                ? "text-xs font-semibold tracking-wide text-white/90 uppercase"
                : "text-xs font-semibold tracking-wide text-[var(--brand-primary,var(--primary))] uppercase"
            }
          >
            {business.name}
            {business.category ? ` · ${business.category}` : ""}
          </span>

          <h1
            className={
              heroImageUrl
                ? "mt-3 text-4xl font-semibold tracking-tight text-balance text-white sm:text-5xl"
                : "mt-3 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl"
            }
          >
            {title}
          </h1>

          <p
            className={
              heroImageUrl
                ? "mx-auto mt-3 max-w-lg text-base text-white/85"
                : "mx-auto mt-3 max-w-lg text-base text-muted-foreground"
            }
          >
            Elegí tu {noun}, fecha y horario y asegurá tu reserva en pocos pasos.
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-11 px-7 text-base bg-[var(--brand-primary,var(--primary))] hover:bg-[var(--brand-primary,var(--primary))]/90"
              render={<a href="#reservar" />}
              nativeButton={false}
            >
              Reservar ahora →
            </Button>
            {whatsappHref && (
              <Button
                size="lg"
                variant={heroImageUrl ? "secondary" : "outline"}
                className="h-11 px-7 text-base"
                render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
                nativeButton={false}
              >
                <MessageCircle className="size-4" data-icon="inline-start" />
                Hablar por WhatsApp
              </Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
