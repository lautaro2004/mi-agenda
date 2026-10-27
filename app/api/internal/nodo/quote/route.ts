import { NextResponse } from "next/server";
import { z } from "zod";

import { getCheckoutQuote } from "@/modules/billing/quote";
import { resolveOwnedBusiness, verifyNodoBillingRequest } from "@/modules/billing/nodo-internal";

const bodySchema = z.object({
  userId: z.string().min(1),
  planId: z.string().min(1),
  interval: z.enum(["month", "year"]).optional(),
  extraUsers: z.coerce.number().int().min(0).max(500).optional(),
  // Combo: plan de Nexo a sumar al plan de Nodo (planId), con descuento.
  withNexoPlanId: z.string().min(1).optional(),
});

export async function POST(request: Request) {
  const denied = verifyNodoBillingRequest(request);
  if (denied) return denied;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  if (!(await resolveOwnedBusiness(parsed.data.userId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const result = await getCheckoutQuote(parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
