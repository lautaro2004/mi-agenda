import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { createResource, listResources } from "@/modules/business/resource";
import { resourceSchema } from "@/lib/schemas";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const resources = await listResources(businessId);
  return NextResponse.json({ resources });
}

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = resourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de recurso inválidos." }, { status: 400 });
  }

  try {
    const resource = await createResource(businessId, parsed.data);
    return NextResponse.json({ resource }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ya existe un recurso con ese nombre." }, { status: 409 });
  }
}
