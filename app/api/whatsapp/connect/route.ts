import { NextResponse } from "next/server";

import { whatsappConnectionManager } from "@/modules/whatsapp/connection/manager";
import { getCurrentBusinessId } from "@/modules/business/current";
import { resolveBusinessPlanFeatures } from "@/modules/billing/subscription";

export async function POST() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const features = await resolveBusinessPlanFeatures(businessId);
  if (!features.whatsappEnabled) {
    return NextResponse.json(
      {
        error: "Conectar WhatsApp está disponible desde el plan Esencial. Mejorá tu plan para activarlo.",
        upgradeRequired: true,
      },
      { status: 403 }
    );
  }

  await whatsappConnectionManager.connect(businessId);
  const connection = whatsappConnectionManager.getStatus(businessId);
  return NextResponse.json({ connection });
}
