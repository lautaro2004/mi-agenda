import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getLeadFormConfig, resetLeadFormConfig, saveLeadFormConfig } from "@/modules/business/lead-form";
import { leadFormConfigSchema } from "@/lib/lead-form";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json({ config: await getLeadFormConfig(businessId) });
}

export async function PUT(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const parsed = leadFormConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  return NextResponse.json({ config: await saveLeadFormConfig(businessId, parsed.data) });
}

// "Volver al formulario estándar".
export async function DELETE() {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ config: await resetLeadFormConfig(businessId) });
}
