import { NextResponse } from "next/server";
import { z } from "zod";

import { cancelSubscription, type CancelSubscriptionError } from "@/modules/billing/mercadopago/cancel";
import { resolveOwnedBusiness, verifyNodoBillingRequest } from "@/modules/billing/nodo-internal";

const bodySchema = z.object({ userId: z.string().min(1) });

const OUR_FAULT_CODES: ReadonlySet<CancelSubscriptionError> = new Set(["unexpected_error", "mercadopago_error"]);

// Baja de la suscripción desde Nodo. Misma función que la pantalla de Nexo
// (cancelSubscription). El body solo trae el userId que Nodo resolvió de su
// sesión; Nexo exige que sea el DUEÑO y resuelve el negocio por su cuenta.
export async function POST(request: Request) {
  const denied = verifyNodoBillingRequest(request);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", message: "Datos inválidos." }, { status: 400 });

  const businessId = await resolveOwnedBusiness(parsed.data.userId);
  if (!businessId) return NextResponse.json({ error: "FORBIDDEN", message: "Solo el dueño del negocio puede cancelar la suscripción." }, { status: 403 });

  const result = await cancelSubscription(businessId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message, detail: result.error.detail },
      { status: OUR_FAULT_CODES.has(result.error.code) ? 502 : 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
