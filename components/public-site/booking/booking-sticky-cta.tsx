import { ArrowRight } from "lucide-react";

import { BookingTrigger } from "@/components/public-site/booking/booking-trigger";

// Barra fija inferior, solo mobile (gran parte del tráfico llega desde
// WhatsApp, el CTA de reservar tiene que ser siempre fácil de encontrar sin
// tener que scrollear hasta arriba). Abre el mismo modal compartido — nunca
// duplica el widget de reserva.
export function BookingStickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur-md sm:hidden">
      <BookingTrigger className="h-11 w-full bg-[var(--brand-primary,var(--primary))] text-base hover:bg-[var(--brand-primary,var(--primary))]/90">
        Reservar ahora
        <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
      </BookingTrigger>
    </div>
  );
}
