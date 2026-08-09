import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { deleteGoal, updateGoal } from "@/modules/employee/profile";
import { employeeGoalSchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = employeeGoalSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos del objetivo inválidos." }, { status: 400 });
  }

  const goal = await updateGoal(businessId, id, parsed.data);
  if (!goal) {
    return NextResponse.json({ error: "Objetivo no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ goal });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteGoal(businessId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Objetivo no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
