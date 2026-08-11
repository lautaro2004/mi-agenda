import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { HeroBookingCard } from "@/components/public-site/hero-booking-card";
import type { BookingIntent } from "@/lib/booking-intent";
import type { Business, SeoConfig, Service } from "@/lib/types";

interface PublicHeroProps {
  business: Business;
  seo: Pick<SeoConfig, "h1">;
  intent: BookingIntent;
  bookingHref: string;
  whatsappHref: string | null;
  heroImageUrl: string | null;
  featuredService: Service | null;
  featuredServiceUsesResources: boolean;
  featuredServiceHref: string | null;
}

const BOOKING_CTA_LABEL: Record<Exclude<BookingIntent, "contact">, string> = {
  booking: "Reservar turno",
  meeting: "Agendar una reunión",
};

// Dos columnas en desktop (texto + panel visual), apiladas en mobile con el
// texto primero — quien llega desde WhatsApp ve la propuesta y el CTA antes
// de esperar a que cargue una imagen. El panel visual es la imagen de
// encabezado real cuando existe (object-cover, nunca deformada) o un
// fallback abstracto premium si no — en ambos casos con la hero booking
// card superpuesta abajo, que es la pieza de conversión real del bloque.
export function PublicHero({
  business,
  seo,
  intent,
  bookingHref,
  whatsappHref,
  heroImageUrl,
  featuredService,
  featuredServiceUsesResources,
  featuredServiceHref,
}: PublicHeroProps) {
  // Mismo criterio en todo el sitio (header, CTA intermedio, CTA final): sin
  // servicio reservable, el CTA principal pasa a ser WhatsApp directamente
  // — nunca dos botones que abren lo mismo (ver sección 4 de la tarea).
  const primary =
    intent !== "contact"
      ? { href: bookingHref, label: BOOKING_CTA_LABEL[intent], external: false }
      : whatsappHref
        ? { href: whatsappHref, label: "Consultar por WhatsApp", external: true }
        : { href: "#servicios", label: "Ver servicios", external: false };
  const showSecondaryWhatsapp = intent !== "contact" && !!whatsappHref;

  return (
    <section className="relative overflow-hidden border-b border-border px-4 pt-8 pb-10 sm:px-6 sm:pt-12 sm:pb-14">
      {!heroImageUrl && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[var(--brand-primary,var(--primary))]/10 via-transparent to-transparent"
          aria-hidden
        />
      )}

      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
            <span className="text-xs font-semibold tracking-wide text-[var(--brand-primary,var(--primary))] uppercase">
              {business.name}
            </span>
            {business.category && (
              <span className="inline-flex items-center rounded-full border border-border bg-card px-3 py-0.5 text-xs font-medium text-muted-foreground">
                {business.category}
              </span>
            )}
          </div>

          <h1 className="mt-3.5 text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl">
            {seo.h1 || business.name}
          </h1>

          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
            <Button
              size="lg"
              className="h-11 bg-[var(--brand-primary,var(--primary))] px-6 text-base hover:bg-[var(--brand-primary,var(--primary))]/90"
              render={primary.external ? <a href={primary.href} target="_blank" rel="noopener noreferrer" /> : <Link href={primary.href} />}
              nativeButton={false}
            >
              {primary.label}
              <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
            </Button>
            {showSecondaryWhatsapp && (
              <Button
                size="lg"
                variant="outline"
                className="h-11 px-6 text-base"
                render={<a href={whatsappHref!} target="_blank" rel="noopener noreferrer" />}
                nativeButton={false}
              >
                <MessageCircle className="size-4" data-icon="inline-start" />
                WhatsApp
              </Button>
            )}
          </div>
        </div>

        <div className="relative h-[400px] w-full overflow-hidden rounded-[1.75rem] border border-border sm:h-[440px] lg:aspect-square lg:h-auto lg:max-h-[440px]">
          {heroImageUrl ? (
            <>
              {/* object-cover: nunca deforma la imagen, solo la recorta al
                  contenedor. No se usa next/image acá para no tener que dar
                  de alta cada host de logo/hero posible en next.config —
                  mismo criterio que el resto del sitio público. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroImageUrl} alt="" className="absolute inset-0 size-full object-cover" />
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/10"
                aria-hidden
              />
              {business.logoUrl && (
                <div className="absolute top-4 right-4 flex size-11 items-center justify-center overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={business.logoUrl} alt={business.name} className="size-full object-cover" />
                </div>
              )}
            </>
          ) : (
            <>
              <div
                className="absolute inset-6 rounded-full bg-[var(--brand-primary,var(--primary))]/15 blur-3xl"
                aria-hidden
              />
              <div
                className="absolute inset-0 bg-card/60"
                style={{
                  backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
                  backgroundSize: "18px 18px",
                }}
                aria-hidden
              />
              <div className="absolute inset-0 flex items-center justify-center p-10 pb-24">
                {business.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={business.logoUrl}
                    alt={business.name}
                    className="size-28 rounded-3xl border border-border bg-card object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex size-28 items-center justify-center rounded-3xl border border-border bg-[var(--brand-primary,var(--primary))] text-4xl font-semibold text-primary-foreground shadow-sm">
                    {business.name.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="absolute inset-x-3 bottom-3 sm:inset-x-4 sm:bottom-4 lg:inset-x-auto lg:right-4 lg:w-72">
            <HeroBookingCard
              intent={intent}
              featuredService={featuredService}
              usesResources={featuredServiceUsesResources}
              bookingHref={featuredServiceHref}
              whatsappHref={whatsappHref}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
