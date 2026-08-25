import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BookingTrigger } from "@/components/public-site/booking/booking-trigger";
import type { BookingIntent } from "@/lib/booking-intent";
import type { Service } from "@/lib/types";

interface BookingSectionProps {
  services: Service[];
  intent: BookingIntent;
  whatsappHref: string | null;
}

const COPY: Record<Exclude<BookingIntent, "contact">, { title: string; subtitle: string; cta: string }> = {
  booking: {
    title: "¿Listo para reservar tu turno?",
    subtitle: "Elegí el servicio, la fecha y el horario que mejor te quede. La disponibilidad es en tiempo real.",
    cta: "Reservar turno",
  },
  meeting: {
    title: "¿Tenés un proyecto en mente?",
    subtitle: "Contanos qué necesitás y coordinemos una reunión para conocer tu proyecto.",
    cta: "Agendar una reunión",
  },
};

// Sección de transición entre Servicios y Proceso/Horarios: solo un CTA que
// abre el modal de reserva compartido (BookingModal) — no se incrusta el
// formulario acá para no repetirlo dos veces en la misma página.
export function BookingSection({ services, intent, whatsappHref }: BookingSectionProps) {
  if (services.length === 0 || intent === "contact") return null;
  const copy = COPY[intent];

  return (
    <section className="border-y border-border bg-[var(--brand-primary,var(--primary))]/[0.06] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-lg text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{copy.title}</h2>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">{copy.subtitle}</p>

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <BookingTrigger
            size="lg"
            className="h-11 px-6 bg-[var(--brand-primary,var(--primary))] hover:bg-[var(--brand-primary,var(--primary))]/90"
          >
            {copy.cta}
          </BookingTrigger>
          {whatsappHref && (
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-6"
              render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
            >
              <MessageCircle className="size-4" data-icon="inline-start" />
              Escribir por WhatsApp
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
