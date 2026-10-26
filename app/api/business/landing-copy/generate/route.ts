import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { generateLandingCopy } from "@/modules/business/landing-copy";

// Botón "Generar con IA" de Sitio web. Si falla, los textos anteriores quedan
// intactos (generateLandingCopy no escribe hasta tener un resultado válido).
export async function POST() {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const result = await generateLandingCopy(businessId);
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 503 });
  return NextResponse.json(result.state);
}
