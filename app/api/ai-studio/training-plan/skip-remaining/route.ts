import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getTrainingPlan, ignoreRemainingSections } from "@/modules/employee/training-plan";

// Escape hatch determinístico: el dueño puede terminar el onboarding sin
// depender de que la IA proponga "ignored" para cada sección restante.
export async function POST() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  await ignoreRemainingSections(businessId);
  const plan = await getTrainingPlan(businessId);

  return NextResponse.json({ plan });
}
