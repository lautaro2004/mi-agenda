import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getTrainingPlan } from "@/modules/employee/training-plan";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const plan = await getTrainingPlan(businessId);
  return NextResponse.json({ plan });
}
