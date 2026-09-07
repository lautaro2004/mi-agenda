"use client";

import * as React from "react";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { maskTail } from "@/lib/mask-secret";
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

// Aproximación en hex del --primary de app/globals.css (oklch(0.585 0.233
// 277.117) claro / oklch(0.685 0.169 277.117) oscuro, convertido vía OKLCH →
// sRGB) — Mercado Pago no soporta fontFamily en customVariables (confirmado
// contra la documentación oficial: solo expone tamaños/pesos de fuente, no
// tipografía), así que esto es lo más cerca que se puede llegar de que el
// Brick combine con el resto de la UI sin tocar la fuente en sí.
const BRICK_PRIMARY_COLOR = { light: "#615fff", dark: "#828cff" };

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

// Cuánto queda visible el panel de éxito antes de cerrarse solo — el X del
// diálogo sigue disponible para cerrarlo antes si el usuario no quiere
// esperar.
const AUTO_CLOSE_MS = 1800;

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
  const [succeeded, setSucceeded] = React.useState(false);

  React.useEffect(() => {
    if (open) ensureMercadoPagoInitialized();
  }, [open]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setCheckoutError(null);
      setSucceeded(false);
    }
  }

  // useCallback con deps mínimas y estables: es el otro lado del mismo
  // problema que CARD_PAYMENT_CUSTOMIZATION — onSubmit/onError también están
  // en el array de dependencias del useEffect que monta el Brick, así que
  // una función nueva en cada render también dispara un remount.
  const handleSubmit = React.useCallback(
    async (formData: CardPaymentFormData) => {
      setCheckoutError(null);

      if (!formData.payer.email) {
        setCheckoutError({ error: "MISSING_PAYER_EMAIL", message: "Falta el email para procesar el pago." });
        throw new Error("payer.email ausente en la respuesta del Card Payment Brick");
      }

      // TEMPORAL — diagnóstico de "Card token service not found" (ya
      // resuelto: era específico de tokens TEST contra /preapproval, no de
      // nuestra integración — ver reporte de esa investigación). Se deja
      // este log liviano por ahora porque sigue siendo útil para correlacionar
      // con el log del backend; sacar cuando ya no haga falta.
      console.log(`[checkout][diag] card_token_id=${maskTail(formData.token)} public_key=${maskTail(PUBLIC_KEY)}`);

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
          // Re-lanzar: el Brick usa el rechazo de esta promesa para volver a
          // habilitar el formulario en vez de mostrar éxito — el diálogo
          // sigue abierto (nunca se toca `open` acá) para corregir y
          // reintentar sin perder el resto del flujo.
          throw new Error(body.message);
        }

        setSucceeded(true);
        onSuccess();
        window.setTimeout(() => setOpen(false), AUTO_CLOSE_MS);
      } finally {
        setSubmitting(false);
      }
    },
    [plan.id, onSuccess]
  );

  const handleBrickError = React.useCallback((error: unknown) => {
    console.error("[checkout] Card Payment Brick error:", error);
  }, []);

  const initialization = React.useMemo(() => ({ amount: plan.monthlyPrice }), [plan.monthlyPrice]);

  // Memoizado con deps vacías a propósito: el color se calcula UNA sola vez
  // al montar (el modo claro/oscuro de esta app sigue prefers-color-scheme,
  // no un toggle en vivo — no hace falta recalcular). Crítico que la
  // referencia de este objeto nunca cambie mientras el diálogo sigue
  // abierto: ver el comentario grande más abajo sobre por qué un
  // `customization` inestable rompía el formulario a mitad de pago.
  const customization = React.useMemo(() => {
    const isDark = typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    return {
      visual: {
        hideFormTitle: true,
        style: {
          theme: "flat" as const,
          customVariables: {
            baseColor: isDark ? BRICK_PRIMARY_COLOR.dark : BRICK_PRIMARY_COLOR.light,
          },
        },
      },
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        {succeeded ? (
          <SuccessPanel planName={plan.name} />
        ) : (
          <>
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
                <div className="relative">
                  <CardPayment
                    initialization={initialization}
                    customization={customization}
                    onSubmit={handleSubmit}
                    onError={handleBrickError}
                  />
                  {submitting && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-background/80 text-sm text-muted-foreground backdrop-blur-sm">
                      <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                      Procesando el pago…
                    </div>
                  )}
                </div>
              )
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Panel de éxito — reemplaza al Brick por completo en vez de solo cerrar el
// diálogo de golpe con un toast: da una confirmación clara antes de
// desaparecer sola (o al cerrar el diálogo a mano).
function SuccessPanel({ planName }: { planName: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="size-7 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div>
        <p className="text-base font-semibold text-foreground">¡Listo, ya sos parte de {planName}!</p>
        <p className="mt-1 text-sm text-muted-foreground">Tu suscripción quedó activa. Ya podés cerrar esta ventana.</p>
      </div>
    </div>
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
