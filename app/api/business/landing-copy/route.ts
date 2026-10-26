import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { deleteLandingCopy, getLandingCopy, saveLandingCopy } from "@/modules/business/landing-copy";
import { landingCopySchema } from "@/lib/schemas";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json(await getLandingCopy(businessId));
}

// Edición manual del dueño.
export async function PUT(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const parsed = landingCopySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json({ error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Datos inválidos." }, { status: 400 });
  }
  return NextResponse.json(await saveLandingCopy(businessId, parsed.data));
}

// "Volver a los textos estándar": borra los personalizados.
export async function DELETE() {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  await deleteLandingCopy(businessId);
  return NextResponse.json({ copy: null, generatedAt: null });
}
