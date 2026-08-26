"use client";

import * as React from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { requestJson } from "@/lib/api-client";
import type { PublicPlan } from "@/lib/subscription-client";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

let mpInitialized = false;
function ensureMercadoPagoInitialized() {
  if (mpInitialized || !PUBLIC_KEY) return;
  initMercadoPago(PUBLIC_KEY, { locale: "es-AR" });
  mpInitialized = true;
}

// Forma del callback onSubmit del Card Payment Brick, solo los campos que
// usamos (el tipo real del SDK, ICardPaymentFormData, no se reexporta desde
// la raíz del paquete — ver node_modules/@mercadopago/sdk-react/esm/bricks/cardPayment/type.d.ts,
// mismo criterio que plans.ts: tipo local mínimo en vez de un import
// interno frágil). payer.email es opcional en el tipo real del SDK, de ahí
// el chequeo en handleSubmit.
interface CardPaymentFormData {
  token: string;
  payer: { email?: string };
}

interface SubscriptionCheckoutDialogProps {
  plan: PublicPlan;
  trigger: React.ReactElement;
  onSuccess: () => void;
}

// Tokeniza la tarjeta EN EL NAVEGADOR vía Checkout Bricks — la tarjeta cruda
// nunca pasa por nuestro backend, solo el token que genera Mercado Pago (ver
// modules/billing/mercadopago/checkout.ts, sección "Fase 3" del pedido: "no
// asumir que card_token_id debe enviarse directamente si el flujo de
// checkout/autorización de Mercado Pago lo resuelve de otra manera" —
// confirmado contra la documentación oficial que para una suscripción CON
// plan asociado este es el único flujo soportado, no existe redirect).
export function SubscriptionCheckoutDialog({ plan, trigger, onSuccess }: SubscriptionCheckoutDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) ensureMercadoPagoInitialized();
  }, [open]);

  async function handleSubmit(formData: CardPaymentFormData) {
    if (!formData.payer.email) {
      toast.error("Falta el email para procesar el pago.");
      throw new Error("payer.email ausente en la respuesta del Card Payment Brick");
    }

    setSubmitting(true);
    try {
      await requestJson("/api/subscriptions/checkout", {
        method: "POST",
        body: JSON.stringify({ planId: plan.id, cardTokenId: formData.token, payerEmail: formData.payer.email }),
      });
      toast.success(`¡Listo! Ya contrataste ${plan.name}.`);
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos procesar el pago.");
      // Re-lanzar: el Brick usa el rechazo de esta promesa para saber que
      // debe volver a habilitar el formulario en vez de mostrar éxito.
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contratar {plan.name}</DialogTitle>
          <DialogDescription>Los datos de tu tarjeta se procesan directamente con Mercado Pago.</DialogDescription>
        </DialogHeader>

        {!PUBLIC_KEY ? (
          <div className="flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>La contratación online todavía no está configurada. Contactanos para activar tu plan.</span>
          </div>
        ) : (
          open && (
            <CardPayment
              initialization={{ amount: plan.monthlyPrice }}
              customization={{ visual: { hideFormTitle: true, hidePaymentButton: submitting } }}
              onSubmit={handleSubmit}
              onError={(error) => {
                console.error("[checkout] Card Payment Brick error:", error);
              }}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
