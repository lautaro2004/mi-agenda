import Link from "next/link";
import { ArrowRight, Clock, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/currency";
import type { BookingIntent } from "@/lib/booking-intent";
import type { Service } from "@/lib/types";

interface HeroBookingCardProps {
  intent: BookingIntent;
  featuredService: Service | null;
  usesResources: boolean;
  // Link a /reservar con el servicio destacado preseleccionado — null cuando
  // no hay featuredService (nada que reservar).
  bookingHref: string | null;
  whatsappHref: string | null;
}

interface CardCopy {
  title: string;
  subtitle: string;
  cta: string;
}

// Copy contextual según intent/recursos — nunca según el nombre del negocio
// o del servicio: "usesResources" viene de getActiveServiceResources(), la
// misma función que ya decide disponibilidad por recurso en el resto del
// sitio (ver modules/business/resource.ts), así que acá no se inventa una
// segunda noción de "usa recursos". Sin detectar literalmente "cancha",
// "sala", etc. — un label genérico alcanza.
function getCopy(intent: BookingIntent, usesResources: boolean): CardCopy {
  if (intent === "meeting") {
    return {
      title: "¿Tenés un proyecto en mente?",
      subtitle: "Coordinemos una reunión para conocer tu proyecto.",
      cta: "Agendar reunión",
    };
  }
  if (usesResources) {
    return {
      title: "Reservá tu espacio",
      subtitle: "Elegí día y horario y asegurá tu turno.",
      cta: "Reservar",
    };
  }
  return {
    title: "Reservá tu turno",
    subtitle: "Elegí el servicio, día y horario que prefieras.",
    cta: "Reservar turno",
  };
}

// Card de conversión superpuesta al panel visual del hero. Determina sola
// qué ofrecer a partir de datos reales: un servicio reservable destacado
// (con o sin recursos) o, si no hay ninguno, una invitación a consultar por
// WhatsApp. Nunca inventa un servicio ni un número — si no hay nada
// accionable (sin reservable y sin WhatsApp configurado), no se renderiza.
export function HeroBookingCard({ intent, featuredService, usesResources, bookingHref, whatsappHref }: HeroBookingCardProps) {
  if (featuredService && bookingHref) {
    const copy = getCopy(intent, usesResources);

    return (
      <div className="w-full rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-sm sm:p-5">
        <p className="text-sm font-semibold text-foreground">{copy.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{copy.subtitle}</p>

        <div className="mt-3 rounded-xl bg-muted/60 px-3 py-2.5">
          <p className="truncate text-sm font-medium text-foreground">{featuredService.name}</p>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" />
              {featuredService.durationMinutes} min
            </span>
            {featuredService.price > 0 && <span>· {formatPrice(featuredService.price)}</span>}
          </div>
        </div>

        <Button
          size="sm"
          className="mt-3 w-full bg-[var(--brand-primary,var(--primary))] hover:bg-[var(--brand-primary,var(--primary))]/90"
          render={<Link href={bookingHref} />}
          nativeButton={false}
        >
          {copy.cta}
          <ArrowRight className="size-3.5" data-icon="inline-end" />
        </Button>
      </div>
    );
  }

  if (whatsappHref) {
    return (
      <div className="w-full rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-sm sm:p-5">
        <p className="text-sm font-semibold text-foreground">¿Tenés un proyecto en mente?</p>
        <p className="mt-1 text-xs text-muted-foreground">Hablemos sobre lo que necesitás.</p>

        <Button
          size="sm"
          className="mt-3 w-full bg-[var(--brand-primary,var(--primary))] hover:bg-[var(--brand-primary,var(--primary))]/90"
          render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
          nativeButton={false}
        >
          <MessageCircle className="size-3.5" data-icon="inline-start" />
          Consultar por WhatsApp
          <ArrowRight className="size-3.5" data-icon="inline-end" />
        </Button>
      </div>
    );
  }

  return null;
}
