import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getServiceResourceIds, setServiceResources } from "@/modules/business/resource";
import { serviceResourcesSchema } from "@/lib/schemas";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const resourceIds = await getServiceResourceIds(businessId, id);
  return NextResponse.json({ resourceIds });
}

// Reemplaza el conjunto completo de recursos vinculados a este servicio —
// mandar [] es válido y significa "este servicio deja de usar recursos"
// (vuelve a la agenda general, sin perder ningún Appointment existente).
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = serviceResourcesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }

  try {
    await setServiceResources(businessId, id, parsed.data.resourceIds);
    const resourceIds = await getServiceResourceIds(businessId, id);
    return NextResponse.json({ resourceIds });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pudimos guardar los recursos." },
      { status: 400 }
    );
  }
}
