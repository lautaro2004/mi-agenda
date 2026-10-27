import { NextResponse } from "next/server";
import { z } from "zod";

import { createSubscriptionCheckout, type CheckoutErrorCode } from "@/modules/billing/mercadopago/checkout";
import { getPlanById } from "@/modules/billing/subscription";
import { resolveOwnedBusiness, verifyNodoBillingRequest } from "@/modules/billing/nodo-internal";

const bodySchema = z.object({
  userId: z.string().min(1),
  planId: z.string().min(1),
  payerEmail: z.string().email(),
  cardTokenId: z.string().min(1),
  interval: z.enum(["month", "year"]).optional(),
  extraUsers: z.coerce.number().int().min(0).max(500).optional(),
  // Combo: plan de Nexo a sumar al plan de Nodo (planId), con descuento.
  withNexoPlanId: z.string().min(1).optional(),
});

const OUR_FAULT_CODES: ReadonlySet<CheckoutErrorCode> = new Set(["MERCADOPAGO_NOT_CONFIGURED", "NEXO_ACTIVATION_ERROR", "UNEXPECTED_ERROR"]);

// Contratación desde Nodo. Reutiliza createSubscriptionCheckout (el mismo
// flujo probado de Nexo: idempotencia por ALREADY_SUBSCRIBED, estados, etc.).
export async function POST(request: Request) {
  const denied = verifyNodoBillingRequest(request);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT", message: "Datos inválidos." }, { status: 400 });

  const businessId = await resolveOwnedBusiness(parsed.data.userId);
  if (!businessId) return NextResponse.json({ error: "FORBIDDEN", message: "Solo el dueño del negocio puede contratar." }, { status: 403 });

  // Desde Nodo solo se contratan planes que incluyen Nodo.
  const plan = await getPlanById(parsed.data.planId);
  if (!plan || !plan.products.includes("crm")) {
    return NextResponse.json({ error: "PLAN_NOT_FOUND", message: "El plan elegido no existe." }, { status: 400 });
  }

  const result = await createSubscriptionCheckout({
    businessId,
    planId: parsed.data.planId,
    payerEmail: parsed.data.payerEmail,
    cardTokenId: parsed.data.cardTokenId,
    interval: parsed.data.interval,
    extraUsers: parsed.data.extraUsers,
    withNexoPlanId: parsed.data.withNexoPlanId,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message, detail: result.error.detail, technicalCode: result.error.technicalCode },
      { status: OUR_FAULT_CODES.has(result.error.code) ? 502 : 400 }
    );
  }
  return NextResponse.json({ ok: true, mercadoPagoStatus: result.mercadoPagoStatus });
}
