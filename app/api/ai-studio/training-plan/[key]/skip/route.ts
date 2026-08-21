import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getTrainingPlan, setSectionStatus } from "@/modules/employee/training-plan";
import { SKIP_SECTION_MESSAGE, runTrainingTurn } from "@/modules/employee/training/engine";
import type { TrainingMode } from "@/modules/ai/prompt/training";

interface RouteParams {
  params: Promise<{ key: string }>;
}

interface SkipRequestBody {
  mode?: string;
}

// Escape hatch determinístico para saltear UNA sección puntual (a diferencia
// de /training-plan/skip-remaining, que las salta todas) — botón "Completar
// después" del chat. No depende de que la IA interprete un mensaje de texto
// libre: la sección pasa a "ignored" acá mismo, y recién después se le pide
// a la IA que presente la siguiente (runTrainingTurn ya activa la próxima
// pending sola, ver activateNextPendingSection).
export async function POST(request: Request, { params }: RouteParams) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { key } = await params;
  const body = (await request.json().catch(() => ({}))) as SkipRequestBody;
  const mode: TrainingMode = body.mode === "continuous" ? "continuous" : "onboarding";

  await setSectionStatus(businessId, key, "ignored");

  const continuation = await runTrainingTurn({ businessId, mode, message: SKIP_SECTION_MESSAGE });
  const plan = await getTrainingPlan(businessId);

  return NextResponse.json({
    reply: continuation.reply,
    proposal: continuation.proposal,
    limitReached: continuation.limitReached,
    plan,
  });
}
