import { NextResponse } from "next/server";

import { conversationRepository } from "@/modules/whatsapp/conversations/repository";
import { getCurrentBusinessId } from "@/modules/business/current";
import { isRemoteWhatsApp, proxyJson } from "@/modules/whatsapp/remote";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (isRemoteWhatsApp()) return proxyJson(businessId, "/conversations");

  const conversations = conversationRepository.list(businessId);
  return NextResponse.json({ conversations });
}
