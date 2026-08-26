import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getCurrentBusinessId } from "@/modules/business/current";
import { subscriptionCheckoutSchema } from "@/lib/schemas";
import { createSubscriptionCheckout, type CheckoutError } from "@/modules/billing/mercadopago/checkout";

const ERROR_MESSAGE: Record<CheckoutError, string> = {
  plan_not_found: "El plan elegido no existe.",
  plan_inactive: "Ese plan ya no está disponible.",
  plan_not_synced: "Ese plan todavía no está disponible para contratar — probá de nuevo en unos minutos.",
  already_subscribed: "Ya tenés una suscripción paga activa.",
  mercadopago_error: "No pudimos procesar el pago con Mercado Pago.",
};

// businessId/payerEmail salen SIEMPRE de la sesión (mismo criterio que
// redeem de promo codes), nunca del body — el body solo trae lo que el
// usuario eligió (planId) y lo que generó Checkout Bricks en el navegador
// (cardTokenId).
export async function POST(request: Request) {
  const [businessId, session] = await Promise.all([
    getCurrentBusinessId(),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!businessId || !session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = subscriptionCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const result = await createSubscriptionCheckout({
    businessId,
    planId: parsed.data.planId,
    cardTokenId: parsed.data.cardTokenId,
    payerEmail: parsed.data.payerEmail,
  });

  if (!result.ok) {
    console.error(`[subscriptions/checkout] ${result.error}${result.message ? `: ${result.message}` : ""}`);
    return NextResponse.json({ error: ERROR_MESSAGE[result.error] }, { status: 400 });
  }

  return NextResponse.json({
    status: result.subscription.status,
    mercadoPagoStatus: result.mercadoPagoStatus,
    planName: result.subscription.plan.name,
  });
}
