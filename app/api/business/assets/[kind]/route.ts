import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { AssetValidationError, removeSiteAsset, replaceSiteAsset } from "@/modules/business/assets";
import type { SiteAssetKind } from "@/lib/site-assets";

interface RouteParams {
  params: Promise<{ kind: string }>;
}

function parseKind(value: string): SiteAssetKind | null {
  return value === "logo" || value === "hero" ? value : null;
}

// businessId sale SIEMPRE de la sesión (getCurrentBusinessId), nunca del
// body/query — así un negocio no puede tocar assets de otro cambiando un id
// desde el cliente (ver sección 24 de la tarea).
export async function POST(request: Request, { params }: RouteParams) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const kind = parseKind((await params).kind);
  if (!kind) {
    return NextResponse.json({ error: "Tipo de archivo inválido." }, { status: 400 });
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
    const url = await replaceSiteAsset(businessId, kind, { bytes, mimeType: file.type, size: file.size });
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof AssetValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(`[api/business/assets/${kind}] Error al subir el archivo:`, error);
    return NextResponse.json({ error: "No pudimos subir el archivo. Intentá de nuevo." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const kind = parseKind((await params).kind);
  if (!kind) {
    return NextResponse.json({ error: "Tipo de archivo inválido." }, { status: 400 });
  }

  try {
    await removeSiteAsset(businessId, kind);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(`[api/business/assets/${kind}] Error al eliminar el archivo:`, error);
    return NextResponse.json({ error: "No pudimos eliminar el archivo. Intentá de nuevo." }, { status: 500 });
  }
}
