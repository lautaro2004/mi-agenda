import { CalendarClock, CreditCard, MapPin, MessageCircleQuestion } from "lucide-react";

import { buildWhatsappHref } from "@/lib/whatsapp-link";
import type { Business } from "@/lib/types";

interface BookingImportantInfoProps {
  business: Business;
  whatsappHref: string | null;
}

const BRAND = "var(--brand-primary,var(--primary))";

function formatDepositLabel(business: Business): string | null {
  if (!business.depositRequired) return null;
  if (business.depositType === "percentage" && business.depositPercentage) {
    return `Para confirmar tu reserva pedimos una seña del ${business.depositPercentage}% por transferencia.`;
  }
  if (business.depositType === "fixed" && business.depositFixedAmount) {
    return `Para confirmar tu reserva pedimos una seña de $${business.depositFixedAmount.toLocaleString("es-AR")} por transferencia.`;
  }
  return "Para confirmar tu reserva pedimos una seña por transferencia.";
}

function InfoItem({ icon: Icon, title, children }: { icon: typeof MapPin; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-border bg-card p-5">
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-primary-foreground"
        style={{ background: BRAND }}
        aria-hidden
      >
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
        <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

// Información real del negocio, nunca texto de relleno: cada ítem aparece
// solo si hay dato (ubicación, seña configurada, WhatsApp). Sin ninguno, la
// sección no se renderiza.
export function BookingImportantInfo({ business, whatsappHref }: BookingImportantInfoProps) {
  const depositLabel = formatDepositLabel(business);
  const address = business.address?.trim();
  const doubtsHref = buildWhatsappHref(
    business.whatsappNumber,
    "Hola, tengo una duda sobre disponibilidad, precios o el servicio."
  );
  if (!depositLabel && !whatsappHref && !address) return null;

  return (
    <section className="border-y border-border bg-muted/30 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Antes de reservar</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {address && (
            <InfoItem icon={MapPin} title="Dónde estamos">
              {address}
            </InfoItem>
          )}
          {depositLabel && (
            <InfoItem icon={CreditCard} title="Seña">
              {depositLabel}
            </InfoItem>
          )}
          {doubtsHref && (
            <InfoItem icon={MessageCircleQuestion} title="Dudas">
              ¿Sobre disponibilidad, precios o el servicio?{" "}
              <a
                href={doubtsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                style={{ color: BRAND }}
              >
                Consultar por WhatsApp
              </a>
            </InfoItem>
          )}
          {whatsappHref && (
            <InfoItem icon={CalendarClock} title="Cambios y cancelaciones">
              ¿Necesitás cancelar o cambiar el horario? Escribinos por WhatsApp y te ayudamos.
            </InfoItem>
          )}
        </div>
      </div>
    </section>
  );
}
