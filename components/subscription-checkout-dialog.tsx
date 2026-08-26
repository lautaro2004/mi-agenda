"use client";

import * as React from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { PublicPlan } from "@/lib/subscription-client";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;
// Las Public Key de sandbox siempre empiezan con "TEST-" (documentado por
// Mercado Pago) — se usa para decidir si mostrar el código técnico del
// error de forma discreta, sin necesitar una env var aparte.
const IS_SANDBOX = PUBLIC_KEY?.startsWith("TEST-") ?? false;

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

// Espejo de CheckoutErrorResult (modules/billing/mercadopago/checkout.ts) —
// lo que devuelve POST /api/subscriptions/checkout cuando falla.
interface CheckoutErrorBody {
  error: string;
  message: string;
  detail?: string;
  technicalCode?: string;
}

// Códigos que indican que MERCADO PAGO rechazó o no confirmó el pago (el
// usuario puede accionar: revisar la tarjeta, probar otra). Todo lo demás
// que puede devolver el endpoint es un problema de configuración/estado de
// Nexo — el usuario no puede resolverlo reintentando con otra tarjeta. Ver
// CheckoutErrorCode en modules/billing/mercadopago/checkout.ts, la fuente
// de verdad de estos códigos.
const MERCADOPAGO_ERROR_CODES = new Set(["MERCADOPAGO_CHECKOUT_ERROR", "MERCADOPAGO_UNEXPECTED_STATUS"]);

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
  const [checkoutError, setCheckoutError] = React.useState<CheckoutErrorBody | null>(null);

  React.useEffect(() => {
    if (open) ensureMercadoPagoInitialized();
  }, [open]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setCheckoutError(null);
  }

  async function handleSubmit(formData: CardPaymentFormData) {
    setCheckoutError(null);

    if (!formData.payer.email) {
      setCheckoutError({ error: "MISSING_PAYER_EMAIL", message: "Falta el email para procesar el pago." });
      throw new Error("payer.email ausente en la respuesta del Card Payment Brick");
    }

    setSubmitting(true);
    try {
      // fetch directo, no requestJson(): requestJson asume que el campo
      // `error` del body YA es el texto para mostrar (ver lib/api-client.ts)
      // — acá `error` es un código estable (CheckoutErrorCode) y `message`/
      // `detail`/`technicalCode` son los que arma el backend para mostrar
      // (ver checkout.ts). Cambiar el contrato de requestJson afectaría a
      // todos los demás endpoints que lo usan, así que este componente lo
      // maneja por su cuenta.
      const response = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, cardTokenId: formData.token, payerEmail: formData.payer.email }),
      });

      if (!response.ok) {
        const body: CheckoutErrorBody = await response.json().catch(() => ({
          error: "UNKNOWN_ERROR",
          message: "No pudimos procesar el pago.",
        }));
        setCheckoutError(body);
        // Re-lanzar (sin volver a tocar el estado del diálogo): el Brick usa
        // el rechazo de esta promesa para volver a habilitar el formulario
        // en vez de mostrar éxito — el diálogo se queda abierto tal cual
        // está (open nunca pasa a false acá) para que se pueda corregir y
        // reintentar sin perder el resto del flujo.
        throw new Error(body.message);
      }

      toast.success(`¡Listo! Ya contrataste ${plan.name}.`);
      setOpen(false);
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contratar {plan.name}</DialogTitle>
          <DialogDescription>Los datos de tu tarjeta se procesan directamente con Mercado Pago.</DialogDescription>
        </DialogHeader>

        {checkoutError && <CheckoutErrorNotice error={checkoutError} />}

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

// Mensaje persistente dentro del modal (no un toast, que es fácil de perder)
// — diferencia "Mercado Pago rechazó el pago" (el usuario puede accionar)
// de un problema de Nexo, y muestra el código técnico de forma discreta
// solo en sandbox, nunca información sensible (son códigos públicos
// documentados por Mercado Pago, ver modules/billing/mercadopago/errors.ts).
function CheckoutErrorNotice({ error }: { error: CheckoutErrorBody }) {
  const isMercadoPagoError = MERCADOPAGO_ERROR_CODES.has(error.error);
  const heading = isMercadoPagoError ? "No pudimos completar la suscripción" : "No pudimos completar la contratación";

  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <p className="font-medium">{heading}</p>
          <p>{error.message}</p>
          {error.detail && <p>{error.detail}</p>}
          {isMercadoPagoError && (
            <p className="mt-1 text-destructive/90">Revisá los datos de la tarjeta de prueba o utilizá otra tarjeta de prueba.</p>
          )}
        </div>
      </div>
      {IS_SANDBOX && error.technicalCode && (
        <p className="ml-6 font-mono text-[11px] text-destructive/70">Código: {error.technicalCode}</p>
      )}
    </div>
  );
}
