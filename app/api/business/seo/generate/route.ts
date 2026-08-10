import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { generateSeoConfig } from "@/modules/business/seo";

// Botón "Actualizar SEO" del dashboard — regeneración manual, en cualquier
// momento (no depende de isReadyForSeoGeneration, esa condición es solo para
// el disparo automático). Si falla, generateSeoConfig() nunca toca la
// configuración anterior — el dueño se queda con la última que funcionó.
export async function POST() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const result = await generateSeoConfig(businessId);
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "No pudimos generar el SEO." }, { status: 503 });
  }

  return NextResponse.json({ seo: result.config });
}
