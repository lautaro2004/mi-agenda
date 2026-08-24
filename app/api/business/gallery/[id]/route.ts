import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { deleteGalleryBlock, updateGalleryBlock } from "@/modules/business/gallery";
import { galleryBlockUpdateSchema } from "@/lib/schemas";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = galleryBlockUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de bloque inválidos." }, { status: 400 });
  }

  const block = await updateGalleryBlock(businessId, id, parsed.data);
  if (!block) {
    return NextResponse.json({ error: "Bloque no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ block });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { id } = await params;

  const ok = await deleteGalleryBlock(businessId, id);
  if (!ok) {
    return NextResponse.json({ error: "Bloque no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
