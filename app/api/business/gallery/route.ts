import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { createGalleryBlock, listGalleryBlocks } from "@/modules/business/gallery";
import { resolveBusinessPlanFeatures } from "@/modules/billing/subscription";
import { galleryBlockSchema } from "@/lib/schemas";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const blocks = await listGalleryBlocks(businessId);
  return NextResponse.json({ blocks });
}

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const features = await resolveBusinessPlanFeatures(businessId);
  if (!features.galleryEnabled) {
    return NextResponse.json(
      {
        error: "La galería de fotos está disponible desde el plan Esencial. Mejorá tu plan para activarla.",
        upgradeRequired: true,
      },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = galleryBlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de bloque inválidos." }, { status: 400 });
  }

  const block = await createGalleryBlock(businessId, parsed.data);
  return NextResponse.json({ block }, { status: 201 });
}
