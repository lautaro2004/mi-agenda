import Link from "next/link";
import { ArrowRight, CalendarCheck2, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BookingIntent } from "@/lib/booking-intent";
import type { Business, SeoConfig } from "@/lib/types";

interface PublicHeroProps {
  business: Business;
  seo: Pick<SeoConfig, "h1">;
  intent: BookingIntent;
  bookingHref: string;
  whatsappHref: string | null;
  servicesCount: number;
  heroImageUrl: string | null;
}

const PRIMARY_CTA_LABEL: Record<BookingIntent, string> = {
  booking: "Reservar un turno",
  meeting: "Agendar una reunión",
  contact: "Ver servicios",
};

const INTENT_INDICATOR: Record<BookingIntent, string> = {
  booking: "Reserva online",
  meeting: "Reuniones online",
  contact: "Contacto directo",
};

// Composición en dos columnas en desktop (texto + panel visual) — sin
// heroImageUrl configurado, el panel es decorativo (grid sutil + blob +
// logo/inicial + dos datos reales, nunca stock images). Con heroImageUrl, el
// panel pasa a ser la foto real del negocio (object-cover, sin deformar),
// con el logo superpuesto como sello y las mismas chips flotantes encima.
// En mobile el panel se oculta y queda solo el bloque de texto, ya compacto.
export function PublicHero({
  business,
  seo,
  intent,
  bookingHref,
  whatsappHref,
  servicesCount,
  heroImageUrl,
}: PublicHeroProps) {
  const primaryHref = intent !== "contact" ? bookingHref : "#servicios";

  return (
    <section className="relative overflow-hidden border-b border-border px-4 pt-10 pb-14 sm:px-6 sm:pt-14 sm:pb-16">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[var(--brand-primary,var(--primary))]/10 via-transparent to-transparent"
        aria-hidden
      />

      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
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
              render={<Link href={primaryHref} />}
              nativeButton={false}
            >
              {PRIMARY_CTA_LABEL[intent]}
              <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
            </Button>
            {whatsappHref && (
              <Button
                size="lg"
                variant="outline"
                className="h-11 px-6 text-base"
                render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
                nativeButton={false}
              >
                <MessageCircle className="size-4" data-icon="inline-start" />
                WhatsApp
              </Button>
            )}
          </div>
        </div>

        <div className="relative hidden aspect-square max-h-[380px] w-full lg:block">
          {heroImageUrl ? (
            <>
              <div className="absolute inset-0 overflow-hidden rounded-[2rem] border border-border">
                {/* object-cover: nunca deforma la imagen, solo la recorta al
                    contenedor cuadrado. Ver eslint-disable: mismo criterio
                    que el resto del sitio público (no se usa next/image para
                    no tener que dar de alta cada host de logo/hero posible en
                    next.config). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroImageUrl} alt="" className="size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" aria-hidden />
              </div>
              {business.logoUrl && (
                <div className="absolute top-5 right-5 flex size-12 items-center justify-center overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
                className="absolute inset-0 rounded-[2rem] border border-border bg-card/60"
                style={{
                  backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
                  backgroundSize: "18px 18px",
                }}
                aria-hidden
              />

              <div className="absolute inset-0 flex items-center justify-center p-10">
                {business.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={business.logoUrl}
                    alt={business.name}
                    className="size-32 rounded-3xl border border-border bg-card object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex size-32 items-center justify-center rounded-3xl border border-border bg-[var(--brand-primary,var(--primary))] text-5xl font-semibold text-primary-foreground shadow-sm">
                    {business.name.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
              </div>
            </>
          )}

          {servicesCount > 0 && (
            <div className="absolute top-5 left-0 flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-sm">
              <span className="size-1.5 rounded-full bg-[var(--brand-primary,var(--primary))]" />
              {servicesCount} {servicesCount === 1 ? "servicio" : "servicios"}
            </div>
          )}

          {intent !== "contact" && (
            <div className="absolute right-0 bottom-5 flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-xs font-medium text-foreground shadow-sm">
              <CalendarCheck2 className="size-3.5 text-[var(--brand-primary,var(--primary))]" />
              {INTENT_INDICATOR[intent]}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
