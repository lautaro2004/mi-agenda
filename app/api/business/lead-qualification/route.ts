import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getLeadQualificationSettings, updateLeadQualificationSettings } from "@/modules/inquiries/qualification";
import { leadQualificationSettingsSchema } from "@/lib/schemas";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const settings = await getLeadQualificationSettings(businessId);
  return NextResponse.json({ settings });
}

// Configuración del negocio: admin o dueño (mismo criterio que el
// interruptor de IA de WhatsApp).
export async function PUT(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = leadQualificationSettingsSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Datos inválidos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await updateLeadQualificationSettings(businessId, parsed.data);
  return NextResponse.json({ settings: await getLeadQualificationSettings(businessId) });
}
