import { NextResponse } from "next/server";

import { whatsappConnectionManager } from "@/modules/whatsapp/connection/manager";
import { getCurrentBusinessId } from "@/modules/business/current";

export async function POST() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  await whatsappConnectionManager.connect(businessId);
  const connection = whatsappConnectionManager.getStatus(businessId);
  return NextResponse.json({ connection });
}
