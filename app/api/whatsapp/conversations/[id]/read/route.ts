import { NextResponse } from "next/server";

import { conversationRepository } from "@/modules/whatsapp/conversations/repository";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const conversation = conversationRepository.markRead(id);

  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ conversation });
}
