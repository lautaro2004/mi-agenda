import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { runTrainingTurn } from "@/modules/employee/training/engine";
import { getClientMessages } from "@/modules/employee/training/conversation";
import type { TrainingMode } from "@/modules/ai/prompt/training";

interface ChatRequestBody {
  mode?: string;
  message?: string;
}

function parseMode(value: string | null): TrainingMode {
  return value === "continuous" ? "continuous" : "onboarding";
}

// Rehidrata el chat al cargar la página: el historial vive en el servidor,
// no en el estado del navegador.
export async function GET(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mode = parseMode(searchParams.get("mode"));

  const messages = await getClientMessages(businessId, mode);
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as ChatRequestBody;
  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío." }, { status: 400 });
  }

  const mode = parseMode(body.mode ?? null);

  try {
    const result = await runTrainingTurn({ businessId, mode, message });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[training/chat] error al generar respuesta:", error);
    return NextResponse.json(
      { error: "No pudimos enviar tu mensaje. ¿Querés reintentar?" },
      { status: 503 }
    );
  }
}
