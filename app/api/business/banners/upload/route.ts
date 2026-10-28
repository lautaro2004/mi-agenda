import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentBusinessId } from "@/modules/business/current";
import { resolveBusinessPlanFeatures } from "@/modules/billing/subscription";
import { BannerValidationError, discardBannerImage, uploadBannerImage } from "@/modules/site/banners";

// Sube una imagen de banner para previsualizarla; todavía no queda asociada
// a ningún banner hasta que el dueño guarda el formulario.
export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const features = await resolveBusinessPlanFeatures(businessId);
  if (!features.galleryEnabled) {
    return NextResponse.json({ error: "El contenido visual está disponible desde el plan Esencial.", upgradeRequired: true }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "No pudimos leer el archivo enviado." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No se recibió ningún archivo." }, { status: 400 });

  try {
    const url = await uploadBannerImage(businessId, {
      bytes: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type,
      size: file.size,
    });
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof BannerValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[api/business/banners/upload] Error al subir:", error);
    return NextResponse.json({ error: "No pudimos subir la imagen. Intentá de nuevo." }, { status: 500 });
  }
}

const discardSchema = z.object({ url: z.string().url().max(600) });

// Descarta una imagen subida que el dueño reemplazó o canceló antes de guardar.
export async function DELETE(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const parsed = discardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  await discardBannerImage(businessId, parsed.data.url);
  return NextResponse.json({ ok: true });
}
