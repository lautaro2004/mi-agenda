import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { activateSection, getTrainingPlan } from "@/modules/employee/training-plan";

interface RouteParams {
  params: Promise<{ key: string }>;
}

// Retomar una sección puntual desde AI Studio (pending o ignored) — "[
// Completar {sección} → ]" en TrainingPlanStatus. Solo cambia cuál es la
// sección activa; el dueño sigue la charla desde el chat como siempre.
export async function POST(_request: Request, { params }: RouteParams) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { key } = await params;
  await activateSection(businessId, key);
  const plan = await getTrainingPlan(businessId);

  return NextResponse.json({ plan });
}
