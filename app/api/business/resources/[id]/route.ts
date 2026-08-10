import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentBusinessId } from "@/modules/business/current";
import { deleteResource, setResourceActive, updateResource } from "@/modules/business/resource";
import { resourceSchema } from "@/lib/schemas";

const toggleActiveSchema = z.object({ active: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Dos formas de PATCH: togglear "active" (desde la lista), o editar
  // nombre/descripción (desde el diálogo de edición) — se distinguen por la
  // forma del body en vez de tener dos rutas separadas para algo tan chico.
  const toggle = toggleActiveSchema.safeParse(body);
  if (toggle.success && !("name" in body)) {
    const resource = await setResourceActive(businessId, id, toggle.data.active);
    if (!resource) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }
    return NextResponse.json({ resource });
  }

  const parsed = resourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de recurso inválidos." }, { status: 400 });
  }

  try {
    const resource = await updateResource(businessId, id, parsed.data);
    if (!resource) {
      return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
    }
    return NextResponse.json({ resource });
  } catch {
    return NextResponse.json({ error: "Ya existe un recurso con ese nombre." }, { status: 409 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const { result } = await deleteResource(businessId, id);

  if (result === "not_found") {
    return NextResponse.json({ error: "Recurso no encontrado." }, { status: 404 });
  }

  // "deactivated": tenía turnos asociados (historial real), así que en vez
  // de perder ese contexto se desactivó en lugar de borrarse — la UI debe
  // mostrar esto como éxito, pero con un mensaje distinto al de un borrado
  // real.
  return NextResponse.json({ ok: true, result });
}
