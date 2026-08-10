import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getSeoConfig } from "@/modules/business/seo";
import { getOrCreateSlug } from "@/modules/business/slug";

// Estado actual del SEO para la pantalla del dashboard — nunca dispara
// Gemini, solo lee lo que ya está guardado (o null si todavía no se generó).
export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const [seo, slug] = await Promise.all([getSeoConfig(businessId), getOrCreateSlug(businessId)]);
  return NextResponse.json({ seo, slug });
}
