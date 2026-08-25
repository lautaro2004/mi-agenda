import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { grantBenefitSchema } from "@/lib/schemas";
import { grantTemporaryPlan } from "@/modules/billing/subscription";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Otorga un plan superior temporal (sección 1 del pedido) — reutiliza
// grantTemporaryPlan()/assignSubscription(), nunca una segunda lógica de
// suscripciones. Vuelve solo al plan anterior al vencer (ver
// app/api/cron/revert-expired-benefits).
export async function POST(request: Request, { params }: RouteParams) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id: businessId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = grantBenefitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const expiresAt = new Date(`${parsed.data.expiresAt}T23:59:59`);
  if (Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: "Fecha de vencimiento inválida." }, { status: 400 });
  }
  if (expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "La fecha de vencimiento debe ser futura." }, { status: 400 });
  }

  const result = await grantTemporaryPlan({ businessId, planId: parsed.data.planId, expiresAt });
  if (!result.ok) {
    const message = result.error === "plan_not_found" ? "Plan no encontrado." : "Ese plan está desactivado.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ subscription: result.subscription });
}
