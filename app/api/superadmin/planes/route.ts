import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { planSchema } from "@/lib/schemas";
import { createPlan, listPlansForAdmin } from "@/modules/billing/subscription";

export async function GET() {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const plans = await listPlansForAdmin();
  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = planSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  try {
    const plan = await createPlan(parsed.data);
    return NextResponse.json({ plan }, { status: 201 });
  } catch (error) {
    // Choque más probable: slug duplicado (@unique en Plan.slug).
    console.error("[superadmin/planes] Error al crear plan:", error);
    return NextResponse.json({ error: "No pudimos crear el plan. ¿El slug ya existe?" }, { status: 400 });
  }
}
