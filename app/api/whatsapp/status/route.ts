import { NextResponse } from "next/server";

import { whatsappConnectionManager } from "@/modules/whatsapp/connection/manager";
import { getCurrentBusinessId } from "@/modules/business/current";
import { isRemoteWhatsApp, proxyJson } from "@/modules/whatsapp/remote";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (isRemoteWhatsApp()) return proxyJson(businessId, "/status");

  const connection = whatsappConnectionManager.getStatus(businessId);
  return NextResponse.json({ connection });
}
