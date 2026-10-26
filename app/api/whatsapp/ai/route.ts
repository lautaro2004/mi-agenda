import { NextResponse } from "next/server";

import { whatsappConnectionManager } from "@/modules/whatsapp/connection/manager";
import { getCurrentBusinessId } from "@/modules/business/current";
import { isRemoteWhatsApp, proxyJson } from "@/modules/whatsapp/remote";

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as { enabled?: boolean };
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "El campo 'enabled' es requerido." }, { status: 400 });
  }

  if (isRemoteWhatsApp()) {
    return proxyJson(businessId, "/ai", { method: "POST", body: JSON.stringify({ enabled: body.enabled }) });
  }

  try {
    await whatsappConnectionManager.setAiEnabled(businessId, body.enabled);
  } catch (error) {
    console.error("[WhatsApp AI API] Error guardando el estado de la IA:", error);
    return NextResponse.json({ error: "No pudimos guardar el estado de la IA." }, { status: 500 });
  }
  const connection = whatsappConnectionManager.getStatus(businessId);
  return NextResponse.json({ connection });
}
