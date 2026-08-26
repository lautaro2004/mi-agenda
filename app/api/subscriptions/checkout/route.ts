import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getCurrentBusinessId } from "@/modules/business/current";
import { subscriptionCheckoutSchema } from "@/lib/schemas";
import { createSubscriptionCheckout, type CheckoutErrorCode } from "@/modules/billing/mercadopago/checkout";

// Códigos que indican que el problema es NUESTRO (config faltante, o un
// pago ya autorizado por Mercado Pago que no pudimos reflejar en Nexo) —
// nunca algo que el usuario pueda resolver reintentando con otra tarjeta.
// 502, no 400: el cliente hizo todo bien. Todo lo demás es 400 (el usuario
// puede accionar: elegir otro plan, revisar la tarjeta).
const OUR_FAULT_CODES: ReadonlySet<CheckoutErrorCode> = new Set([
  "MERCADOPAGO_NOT_CONFIGURED",
  "NEXO_ACTIVATION_ERROR",
  "UNEXPECTED_ERROR",
]);

// businessId/payerEmail salen SIEMPRE de la sesión (mismo criterio que
// redeem de promo codes), nunca del body — el body solo trae lo que el
// usuario eligió (planId) y lo que generó Checkout Bricks en el navegador
// (cardTokenId). La forma de la respuesta ({error, message, detail?,
// technicalCode?}) es la que espera SubscriptionCheckoutDialog — este
// endpoint se llama con fetch directo, no con requestJson() (ver comentario
// en el componente: requestJson asume que `error` ya es el texto para
// mostrar, acá `error` es un código y `message` es el texto).
export async function POST(request: Request) {
  const [businessId, session] = await Promise.all([
    getCurrentBusinessId(),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!businessId || !session) {
    return NextResponse.json({ error: "UNAUTHENTICATED", message: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = subscriptionCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Datos inválidos." },
      { status: 400 }
    );
  }

  const result = await createSubscriptionCheckout({
    businessId,
    planId: parsed.data.planId,
    cardTokenId: parsed.data.cardTokenId,
    payerEmail: parsed.data.payerEmail,
  });

  if (!result.ok) {
    const status = OUR_FAULT_CODES.has(result.error.code) ? 502 : 400;
    return NextResponse.json(
      {
        error: result.error.code,
        message: result.error.message,
        detail: result.error.detail,
        technicalCode: result.error.technicalCode,
      },
      { status }
    );
  }

  return NextResponse.json({
    status: result.subscription.status,
    mercadoPagoStatus: result.mercadoPagoStatus,
    planName: result.subscription.plan.name,
  });
}
