import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { resolveBusinessPlanFeatures } from "@/modules/billing/subscription";
import { runSimulatorTurn, type SimulatorMessage } from "@/modules/employee/simulator/engine";

interface ChatRequestBody {
  message?: string;
  history?: { role?: string; text?: string }[];
}

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // El simulador prueba al asistente de IA: solo planes con IA (Profesional+).
  const features = await resolveBusinessPlanFeatures(businessId);
  if (!features.customTrainingEnabled) {
    return NextResponse.json(
      { error: "El asistente de IA está disponible desde el plan Profesional. Mejorá tu plan desde /dashboard/suscripcion." },
      { status: 403 }
    );
  }

  const body = (await request.json()) as ChatRequestBody;
  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "El mensaje no puede estar vacío." }, { status: 400 });
  }

  const history: SimulatorMessage[] = (body.history ?? []).filter(
    (m): m is SimulatorMessage =>
      (m.role === "customer" || m.role === "ai") && typeof m.text === "string" && m.text.length > 0
  );

  const result = await runSimulatorTurn({ businessId, history, message });
  return NextResponse.json(result);
}
