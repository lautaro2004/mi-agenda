import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { createGoal } from "@/modules/employee/profile";
import { employeeGoalSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = employeeGoalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos del objetivo inválidos." }, { status: 400 });
  }

  const goal = await createGoal(businessId, parsed.data);
  return NextResponse.json({ goal }, { status: 201 });
}
