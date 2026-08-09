import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { deleteRestriction, updateRestriction } from "@/modules/employee/profile";
import { employeeRestrictionSchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = employeeRestrictionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de la restricción inválidos." }, { status: 400 });
  }

  const restriction = await updateRestriction(businessId, id, parsed.data);
  if (!restriction) {
    return NextResponse.json({ error: "Restricción no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ restriction });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteRestriction(businessId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Restricción no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
