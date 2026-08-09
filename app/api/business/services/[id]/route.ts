import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { deleteService, updateService } from "@/modules/business/service";
import { serviceSchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = serviceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de servicio inválidos." }, { status: 400 });
  }

  const service = await updateService(businessId, id, parsed.data);
  if (!service) {
    return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ service });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteService(businessId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Servicio no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
