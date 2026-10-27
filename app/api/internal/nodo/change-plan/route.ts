import { NextResponse } from "next/server";
import { z } from "zod";

import { changePlan } from "@/modules/billing/mercadopago/change-plan";
import { resolveOwnedBusiness, verifyNodoBillingRequest } from "@/modules/billing/nodo-internal";

const bodySchema = z.object({
  userId: z.string().min(1),
  planId: z.string().min(1),
  extraUsers: z.coerce.number().int().min(0).max(500).optional(),
  // Combo: plan de Nexo a sumar al plan de Nodo (planId), con descuento.
  withNexoPlanId: z.string().min(1).optional(),
});

// Cambio de plan desde Nodo. Precio, límites y Mercado Pago los resuelve
// Nexo; el body solo trae el plan pedido y el userId de la sesión de Nodo
// (debe ser el DUEÑO del negocio).
export async function POST(request: Request) {
  const denied = verifyNodoBillingRequest(request);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID", message: "Datos inválidos." }, { status: 400 });

  const businessId = await resolveOwnedBusiness(parsed.data.userId);
  if (!businessId) return NextResponse.json({ error: "FORBIDDEN", message: "Solo el dueño del negocio puede cambiar el plan." }, { status: 403 });

  const result = await changePlan(businessId, { planId: parsed.data.planId, extraUsers: parsed.data.extraUsers, withNexoPlanId: parsed.data.withNexoPlanId });
  if (!result.ok) {
    const status = result.error === "MERCADOPAGO_ERROR" || result.error === "FX_UNAVAILABLE" ? 502 : 400;
    return NextResponse.json({ error: result.error, message: result.message }, { status });
  }
  return NextResponse.json(result);
}
