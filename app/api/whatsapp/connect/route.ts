import { NextResponse } from "next/server";

import { whatsappConnectionManager } from "@/modules/whatsapp/connection/manager";
import { getCurrentBusinessId } from "@/modules/business/current";
import { isRemoteWhatsApp, proxyJson } from "@/modules/whatsapp/remote";
import { resolveBusinessPlanFeatures } from "@/modules/billing/subscription";

export async function POST() {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
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

  if (isRemoteWhatsApp()) return proxyJson(businessId, "/connect", { method: "POST" });

  await whatsappConnectionManager.connect(businessId);
  const connection = whatsappConnectionManager.getStatus(businessId);
  return NextResponse.json({ connection });
}
