import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getMenuState, setMenuEnabled } from "@/modules/business/menu";
import { resolveBusinessPlanFeatures } from "@/modules/billing/subscription";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const menu = await getMenuState(businessId);
  return NextResponse.json({ menu });
}

export async function PATCH(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { enabled?: boolean } | null;
  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Falta indicar si activar o desactivar la carta." }, { status: 400 });
  }

  if (body.enabled) {
    const features = await resolveBusinessPlanFeatures(businessId);
    if (!features.digitalMenuEnabled) {
      return NextResponse.json(
        {
          error: "La carta digital está disponible desde el plan Profesional. Mejorá tu plan para activarla.",
          upgradeRequired: true,
        },
        { status: 403 }
      );
    }
  }

  const menu = await setMenuEnabled(businessId, body.enabled);
  return NextResponse.json({ menu });
}
