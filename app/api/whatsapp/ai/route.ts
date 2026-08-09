import { NextResponse } from "next/server";

import { whatsappConnectionManager } from "@/modules/whatsapp/connection/manager";
import { getCurrentBusinessId } from "@/modules/business/current";

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as { enabled?: boolean };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "El campo 'enabled' es requerido." }, { status: 400 });
  }

  whatsappConnectionManager.setAiEnabled(businessId, body.enabled);
  const connection = whatsappConnectionManager.getStatus(businessId);
  return NextResponse.json({ connection });
}
