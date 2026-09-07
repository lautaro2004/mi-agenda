import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getCurrentBusinessId } from "@/modules/business/current";
import { cancelSubscription, type CancelSubscriptionError } from "@/modules/billing/mercadopago/cancel";

// Mismos criterios que checkout/route.ts: businessId sale de la sesión,
// nunca del body (no hay body — no hace falta elegir nada, solo confirmar).
const OUR_FAULT_CODES: ReadonlySet<CancelSubscriptionError> = new Set(["unexpected_error"]);

export async function POST() {
  const [businessId, session] = await Promise.all([
    getCurrentBusinessId(),
    auth.api.getSession({ headers: await headers() }),
  ]);
  if (!businessId || !session) {
    return NextResponse.json({ error: "UNAUTHENTICATED", message: "No autenticado." }, { status: 401 });
  }

  const result = await cancelSubscription(businessId);

  if (!result.ok) {
    const status = OUR_FAULT_CODES.has(result.error.code) ? 502 : 400;
    return NextResponse.json(
      { error: result.error.code, message: result.error.message, detail: result.error.detail },
      { status }
    );
  }

  return NextResponse.json({ ok: true });
}
