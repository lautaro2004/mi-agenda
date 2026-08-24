import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { GalleryValidationError, addGalleryImage } from "@/modules/business/gallery";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { id: blockId } = await params;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el archivo enviado." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const image = await addGalleryImage(businessId, blockId, { bytes, mimeType: file.type, size: file.size });
    return NextResponse.json({ image }, { status: 201 });
  } catch (error) {
    if (error instanceof GalleryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/business/gallery/[id]/images] Error al subir la imagen:", error);
    return NextResponse.json({ error: "No pudimos subir la imagen. Intentá de nuevo." }, { status: 500 });
  }
}
