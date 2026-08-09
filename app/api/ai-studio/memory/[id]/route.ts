import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { deleteMemoryEntry, updateMemoryEntry } from "@/modules/employee/memory";
import { memoryEntrySchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = memoryEntrySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de la entrada inválidos." }, { status: 400 });
  }

  const entry = await updateMemoryEntry(businessId, id, parsed.data);
  if (!entry) {
    return NextResponse.json({ error: "Entrada no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ entry });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteMemoryEntry(businessId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Entrada no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
