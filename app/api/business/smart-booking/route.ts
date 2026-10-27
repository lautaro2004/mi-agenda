import { NextResponse } from "next/server";

import { smartBookingRulesSchema } from "@/lib/smart-booking";
import { canUseSmartBooking } from "@/modules/billing/subscription";
import { getCurrentBusinessId } from "@/modules/business/current";
import { getSmartBookingRules, saveSmartBookingRules } from "@/modules/smart-booking/service";

const UPGRADE = {
  error: "La agenda inteligente está disponible desde el plan Esencial+. Mejorá tu plan para configurarla.",
  upgradeRequired: true,
};

// Lectura: cualquier miembro del negocio ve el estado (la pantalla muestra el
// aviso de plan). Las reglas guardadas se conservan aunque el plan cambie.
export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const [state, allowed] = await Promise.all([getSmartBookingRules(businessId), canUseSmartBooking(businessId)]);
  return NextResponse.json({ ...state, allowed });
}

// Escritura: admin + permiso del plan validado en el servidor (no alcanza con
// ocultar el botón).
export async function PUT(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  if (!(await canUseSmartBooking(businessId))) {
    return NextResponse.json(UPGRADE, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = smartBookingRulesSchema.safeParse(body?.rules);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Reglas inválidas." }, { status: 400 });
  }
  const instructions = typeof body?.instructions === "string" ? body.instructions.slice(0, 2000) : undefined;

  try {
    await saveSmartBookingRules(businessId, parsed.data, { instructions });
    return NextResponse.json({ ok: true, rules: parsed.data });
  } catch (error) {
    console.error("[Smart Booking API] PUT error:", error);
    return NextResponse.json({ error: "No pudimos guardar las reglas." }, { status: 500 });
  }
}
