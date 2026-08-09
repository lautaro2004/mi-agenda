import { NextResponse } from "next/server";

import { whatsappConnectionManager } from "@/modules/whatsapp/connection/manager";
import { conversationRepository } from "@/modules/whatsapp/conversations/repository";
import { getCurrentBusinessId } from "@/modules/business/current";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const body = (await request.json()) as { text?: string };
  const text = body.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío." }, { status: 400 });
  }

  try {
    await whatsappConnectionManager.sendMessage(businessId, id, text);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo enviar el mensaje." },
      { status: 409 }
    );
  }

  const conversation = conversationRepository.get(id);
  return NextResponse.json({ conversation });
}
