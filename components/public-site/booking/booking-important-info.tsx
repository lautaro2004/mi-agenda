import { CreditCard, MessageCircleQuestion } from "lucide-react";

import type { Business } from "@/lib/types";

interface BookingImportantInfoProps {
  business: Business;
  whatsappHref: string | null;
}

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

// Información real del negocio, nunca texto institucional de relleno (ver
// sección 15 de la tarea) — si no hay seña configurada y no hay WhatsApp, la
// sección directamente no se renderiza.
export function BookingImportantInfo({ business, whatsappHref }: BookingImportantInfoProps) {
  const depositLabel = formatDepositLabel(business);
  if (!depositLabel && !whatsappHref) return null;

  return (
    <section className="border-y border-border bg-muted/20 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-center text-lg font-semibold text-foreground">Información importante</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {depositLabel && (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <CreditCard className="mt-0.5 size-5 shrink-0 text-[var(--brand-primary,var(--primary))]" />
              <p className="text-sm text-muted-foreground">{depositLabel}</p>
            </div>
          )}
          {whatsappHref && (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <MessageCircleQuestion className="mt-0.5 size-5 shrink-0 text-[var(--brand-primary,var(--primary))]" />
              <p className="text-sm text-muted-foreground">
                ¿Necesitás cancelar o cambiar el horario? Escribinos por WhatsApp y te ayudamos.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
