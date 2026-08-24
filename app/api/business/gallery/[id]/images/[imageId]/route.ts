import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { removeGalleryImage } from "@/modules/business/gallery";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { id: blockId, imageId } = await params;

  const ok = await removeGalleryImage(businessId, blockId, imageId);
  if (!ok) {
    return NextResponse.json({ error: "Imagen no encontrada." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
