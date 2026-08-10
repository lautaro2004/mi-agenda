import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { applyTrainingProposal, trainingProposalSchema } from "@/modules/employee/training/proposal";
import { getTrainingPlan } from "@/modules/employee/training-plan";
import { CONTINUATION_MESSAGE, runTrainingTurn } from "@/modules/employee/training/engine";
import { maybeAutoGenerateSeo } from "@/modules/business/seo";
import type { TrainingMode } from "@/modules/ai/prompt/training";

interface ApplyRequestBody {
  proposal?: unknown;
  mode?: string;
}

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json()) as ApplyRequestBody;
  const parsed = trainingProposalSchema.safeParse(body.proposal);

  if (!parsed.success) {
    return NextResponse.json({ error: "Propuesta inválida." }, { status: 400 });
  }

  try {
    await applyTrainingProposal(businessId, parsed.data);

    // Orquestación: en vez de dejar que el cliente dispare un segundo turno de
    // chat por separado (y que la conversación dependa de que eso ocurra), acá
    // mismo generamos la continuación — así guardar nunca deja la charla
    // esperando a que el dueño la empuje. El prompt no cambia: es la misma
    // llamada a runTrainingTurn() que usa /training/chat, que además persiste
    // este turno (incluido el "Sí, guardalo así." sintético) como cualquier otro.
    const mode: TrainingMode = body.mode === "continuous" ? "continuous" : "onboarding";

    const continuation = await runTrainingTurn({ businessId, mode, message: CONTINUATION_MESSAGE });

    // El estado del panel (checklist en vivo) viaja en la misma respuesta:
    // el cliente lo aplica directo, sin otra ida y vuelta al servidor.
    const plan = await getTrainingPlan(businessId);

    // Si esta propuesta fue la que terminó de cerrar el entrenamiento
    // inicial, es el otro punto natural para chequear si ya es momento de
    // generar el SEO automático (ver maybeAutoGenerateSeo). No bloquea nada
    // si falla ni si todavía no corresponde.
    await maybeAutoGenerateSeo(businessId);

    return NextResponse.json({ ok: true, reply: continuation.reply, proposal: continuation.proposal, plan });
  } catch (error) {
    console.error("[training/apply] error al guardar:", error);
    return NextResponse.json(
      { error: "No pudimos guardar esta información. ¿Querés reintentar?" },
      { status: 503 }
    );
  }
}
