import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { moveGalleryBlock } from "@/modules/business/gallery";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { id } = await params;

  const body = (await request.json().catch(() => null)) as { direction?: string } | null;
  if (body?.direction !== "up" && body?.direction !== "down") {
    return NextResponse.json({ error: "Dirección inválida." }, { status: 400 });
  }

  const blocks = await moveGalleryBlock(businessId, id, body.direction);
  if (!blocks) {
    return NextResponse.json({ error: "Bloque no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ blocks });
}
