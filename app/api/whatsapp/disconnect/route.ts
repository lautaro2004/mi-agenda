import { NextResponse } from "next/server";

import { whatsappConnectionManager } from "@/modules/whatsapp/connection/manager";
import { getCurrentBusinessId } from "@/modules/business/current";
import { isRemoteWhatsApp, proxyJson } from "@/modules/whatsapp/remote";

export async function POST() {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (isRemoteWhatsApp()) return proxyJson(businessId, "/disconnect", { method: "POST" });

  await whatsappConnectionManager.disconnect(businessId);
  const connection = whatsappConnectionManager.getStatus(businessId);
  return NextResponse.json({ connection });
}
