import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getBusinessState, updateBusinessInfo } from "@/modules/business/service";
import { resolveBusinessPlanFeatures } from "@/modules/billing/subscription";
import { paymentSettingsSchema } from "@/lib/schemas";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { business } = await getBusinessState(businessId);
  return NextResponse.json({ business });
}

export async function PATCH(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = paymentSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de configuración de pagos inválidos." }, { status: 400 });
  }

  // Solo se bloquea al querer ACTIVAR la seña — desactivarla (depositRequired:
  // false) siempre está permitido, incluso si el plan bajó de categoría con
  // señas ya configuradas, para no dejar a un negocio con una config a medio
  // apagar que no puede tocar.
  if (parsed.data.depositRequired) {
    const features = await resolveBusinessPlanFeatures(businessId);
    if (!features.depositsEnabled) {
      return NextResponse.json(
        {
          error: "La gestión de señas y comprobantes está disponible desde el plan Esencial. Mejorá tu plan para activarla.",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }
  }

  try {
    const business = await updateBusinessInfo(businessId, parsed.data);
    return NextResponse.json({ business });
  } catch (error) {
    console.error("[Payment Settings API] PATCH error:", error);
    return NextResponse.json({ error: "No pudimos guardar la configuración de pagos." }, { status: 500 });
  }
}
