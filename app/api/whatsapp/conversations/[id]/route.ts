import { NextResponse } from "next/server";

import { conversationRepository } from "@/modules/whatsapp/conversations/repository";
import type { ConversationLabel, ConversationStatus } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const conversation = conversationRepository.get(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ conversation });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const body = (await request.json()) as {
    status?: ConversationStatus;
    toggleLabel?: ConversationLabel;
    manualMode?: boolean;
  };

  let conversation = conversationRepository.get(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversación no encontrada." }, { status: 404 });
  }

  if (body.status) {
    conversation = conversationRepository.setStatus(id, body.status);
  }
  if (body.toggleLabel) {
    conversation = conversationRepository.toggleLabel(id, body.toggleLabel);
  }
  if (typeof body.manualMode === "boolean") {
    conversation = conversationRepository.setManualMode(id, body.manualMode);
  }

  return NextResponse.json({ conversation });
}
