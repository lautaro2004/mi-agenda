import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { planUpdateSchema } from "@/lib/schemas";
import { updatePlan } from "@/modules/billing/subscription";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Solo PATCH — no existe (ni va a existir acá) un DELETE físico de planes.
// Un plan con suscripciones no puede eliminarse por la FK RESTRICT de
// Subscription.planId (ver prisma/schema.prisma); la única acción
// destructiva-adyacente que exponemos es desactivarlo (active: false), que
// impide asignarlo a NUEVAS suscripciones sin tocar a quienes ya lo tienen.
export async function PATCH(request: Request, { params }: RouteParams) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = planUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  try {
    const plan = await updatePlan(id, parsed.data);
    if (!plan) {
      return NextResponse.json({ error: "Plan no encontrado." }, { status: 404 });
    }
    return NextResponse.json({ plan });
  } catch (error) {
    console.error("[superadmin/planes/:id] Error al actualizar plan:", error);
    return NextResponse.json({ error: "No pudimos actualizar el plan. ¿El slug ya existe?" }, { status: 400 });
  }
}
