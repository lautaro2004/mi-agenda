import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { createMemoryEntry } from "@/modules/employee/memory";
import { simulatorCorrectionSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = simulatorCorrectionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de la corrección inválidos." }, { status: 400 });
  }

  const { customerMessage, correctedReply } = parsed.data;

  const entry = await createMemoryEntry(
    businessId,
    {
      title: `Corrección: ${customerMessage.slice(0, 60)}`,
      content: `Cuando un cliente pregunte algo como "${customerMessage}", respondé: "${correctedReply}"`,
      category: "Respuestas frecuentes",
      importance: "medium",
      active: true,
    },
    "correction"
  );

  return NextResponse.json({ entry }, { status: 201 });
}
