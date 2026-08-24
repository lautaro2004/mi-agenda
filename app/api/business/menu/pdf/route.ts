import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { MenuValidationError, removeMenuPdf, replaceMenuPdf } from "@/modules/business/menu";

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

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
    const menu = await replaceMenuPdf(businessId, { bytes, mimeType: file.type, size: file.size });
    return NextResponse.json({ menu });
  } catch (error) {
    if (error instanceof MenuValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/business/menu/pdf] Error al subir el PDF:", error);
    return NextResponse.json({ error: "No pudimos subir la carta. Intentá de nuevo." }, { status: 500 });
  }
}

export async function DELETE() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const menu = await removeMenuPdf(businessId);
    return NextResponse.json({ menu });
  } catch (error) {
    console.error("[api/business/menu/pdf] Error al eliminar el PDF:", error);
    return NextResponse.json({ error: "No pudimos eliminar la carta. Intentá de nuevo." }, { status: 500 });
  }
}
