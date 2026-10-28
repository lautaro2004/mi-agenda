import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { resolveBusinessPlanFeatures } from "@/modules/billing/subscription";
import { BannerValidationError, createBanner, listBanners, parseBannerInput } from "@/modules/site/banners";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json({ banners: await listBanners(businessId) });
}

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  // Los banners son contenido visual: mismo permiso de plan que la galería.
  const features = await resolveBusinessPlanFeatures(businessId);
  if (!features.galleryEnabled) {
    return NextResponse.json(
      { error: "El contenido visual está disponible desde el plan Esencial. Mejorá tu plan para activarlo.", upgradeRequired: true },
      { status: 403 }
    );
  }

  const parsed = parseBannerInput(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const banner = await createBanner(businessId, parsed.data);
    return NextResponse.json({ banner }, { status: 201 });
  } catch (error) {
    if (error instanceof BannerValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("[api/business/banners] Error al crear:", error);
    return NextResponse.json({ error: "No pudimos crear el banner. Intentá de nuevo." }, { status: 500 });
  }
}
