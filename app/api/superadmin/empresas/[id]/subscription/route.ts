import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { assignSubscriptionSchema } from "@/lib/schemas";
import { assignSubscription } from "@/modules/billing/subscription";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Asignación manual de plan — todo lo que existe hoy para "activar" un
// negocio (sección 10 del pedido: sin checkout, solo para testing/admin
// interno). Como Subscription.businessId es único, assignSubscription()
// siempre hace upsert: nunca puede crear una segunda suscripción para el
// mismo negocio.
export async function POST(request: Request, { params }: RouteParams) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id: businessId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = assignSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const currentPeriodStart = new Date(parsed.data.currentPeriodStart);
  if (Number.isNaN(currentPeriodStart.getTime())) {
    return NextResponse.json({ error: "Fecha de inicio inválida." }, { status: 400 });
  }

  let currentPeriodEnd: Date | null = null;
  if (parsed.data.currentPeriodEnd) {
    currentPeriodEnd = new Date(parsed.data.currentPeriodEnd);
    if (Number.isNaN(currentPeriodEnd.getTime())) {
      return NextResponse.json({ error: "Fecha de fin inválida." }, { status: 400 });
    }
  }

  const result = await assignSubscription(businessId, {
    planId: parsed.data.planId,
    status: parsed.data.status,
    currentPeriodStart,
    currentPeriodEnd,
    provider: "manual",
  });

  if (!result.ok) {
    const message = result.error === "plan_not_found" ? "Plan no encontrado." : "Ese plan está desactivado.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ subscription: result.subscription });
}
