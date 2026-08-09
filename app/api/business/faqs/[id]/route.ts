import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { deleteFaq, updateFaq } from "@/modules/business/service";
import { faqSchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = faqSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de la pregunta inválidos." }, { status: 400 });
  }

  const faq = await updateFaq(businessId, id, parsed.data);
  if (!faq) {
    return NextResponse.json({ error: "Pregunta no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ faq });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const deleted = await deleteFaq(businessId, id);
  if (!deleted) {
    return NextResponse.json({ error: "Pregunta no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
