import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BookingIntent } from "@/lib/booking-intent";

interface FinalCtaSectionProps {
  intent: BookingIntent;
  bookingHref: string;
  whatsappHref: string | null;
}

const PRIMARY_LABEL: Record<Exclude<BookingIntent, "contact">, string> = {
  booking: "Reservar",
  meeting: "Agendar una reunión",
};

// Título distinto del CTA intermedio (booking-section.tsx) a propósito,
// aunque comparten intención comercial — repetir el mismo titular dos veces
// en la misma página se siente como un bug de contenido, no como refuerzo.
const TITLE: Record<BookingIntent, string> = {
  booking: "¿Querés reservar tu turno?",
  meeting: "Hablemos de tu proyecto",
  contact: "¿Querés empezar?",
};

// El punto de conversión más fuerte de la página: banda a todo el ancho con
// un fondo sutil basado en el color de marca, no una card flotando en medio
// de blanco.
export function FinalCtaSection({ intent, bookingHref, whatsappHref }: FinalCtaSectionProps) {
  const hasBookable = intent !== "contact";
  if (!hasBookable && !whatsappHref) return null;

  const subtitle =
    hasBookable && whatsappHref
      ? intent === "meeting"
        ? "Contanos qué necesitás y veamos cómo podemos ayudarte, por reunión o por WhatsApp."
        : "Reservá tu turno online o escribinos por WhatsApp."
      : hasBookable
        ? intent === "meeting"
          ? "Contanos qué necesitás y veamos cómo podemos ayudarte."
          : "Reservá tu turno online."
        : "Escribinos por WhatsApp y te contamos todo.";

  return (
    <section className="bg-gradient-to-b from-[var(--brand-primary,var(--primary))]/[0.07] to-transparent px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
          {TITLE[intent]}
        </h2>
        <p className="mx-auto mt-3.5 max-w-md text-base text-muted-foreground">{subtitle}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {hasBookable && (
            <Button
              size="lg"
              className="h-12 px-7 text-base bg-[var(--brand-primary,var(--primary))] hover:bg-[var(--brand-primary,var(--primary))]/90"
              render={<Link href={bookingHref} />}
              nativeButton={false}
            >
              {PRIMARY_LABEL[intent as Exclude<BookingIntent, "contact">]}
              <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
            </Button>
          )}
          {whatsappHref && (
            <Button
              size="lg"
              variant={hasBookable ? "outline" : "default"}
              className={
                hasBookable
                  ? "h-12 px-7 text-base"
                  : "h-12 px-7 text-base bg-[var(--brand-primary,var(--primary))] hover:bg-[var(--brand-primary,var(--primary))]/90"
              }
              render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
            >
              <MessageCircle className="size-4" data-icon="inline-start" />
              WhatsApp
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
