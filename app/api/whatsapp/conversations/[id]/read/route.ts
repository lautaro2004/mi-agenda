import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { conversationRepository } from "@/modules/whatsapp/conversations/repository";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const conversation = conversationRepository.markRead(businessId, id);

  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ conversation });
}
