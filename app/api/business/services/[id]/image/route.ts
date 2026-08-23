import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { ServiceImageValidationError, removeServiceImage, replaceServiceImage } from "@/modules/business/service-images";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// businessId sale siempre de la sesión — replaceServiceImage/removeServiceImage
// revalidan que el :id de servicio sea realmente de ese negocio antes de
// tocar Storage o Postgres (mismo criterio que el resto de las rutas de
// assets del negocio).
export async function POST(request: Request, { params }: RouteParams) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { id } = await params;

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
    const url = await replaceServiceImage(businessId, id, { bytes, mimeType: file.type, size: file.size });
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof ServiceImageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[api/business/services/[id]/image] Error al subir la imagen:", error);
    return NextResponse.json({ error: "No pudimos subir la imagen. Intentá de nuevo." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }
  const { id } = await params;

  try {
    await removeServiceImage(businessId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/business/services/[id]/image] Error al eliminar la imagen:", error);
    return NextResponse.json({ error: "No pudimos eliminar la imagen. Intentá de nuevo." }, { status: 500 });
  }
}
