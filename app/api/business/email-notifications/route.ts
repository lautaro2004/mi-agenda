import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getEmailSettings, updateEmailSettings } from "@/modules/email/settings";
import { emailNotificationSettingsSchema } from "@/lib/schemas";

// El negocio siempre sale de la sesión; nunca se acepta un businessId del body.
export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  return NextResponse.json({ settings: await getEmailSettings(businessId) });
}

export async function PATCH(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = emailNotificationSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Configuración de notificaciones inválida." }, { status: 400 });
  }

  try {
    return NextResponse.json({ settings: await updateEmailSettings(businessId, parsed.data) });
  } catch (error) {
    console.error("[Email Notifications API] PATCH error:", error);
    return NextResponse.json({ error: "No pudimos guardar la configuración." }, { status: 500 });
  }
}
