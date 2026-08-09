import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { createFaq } from "@/modules/business/service";
import { faqSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = faqSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de la pregunta inválidos." }, { status: 400 });
  }

  const faq = await createFaq(businessId, parsed.data);
  return NextResponse.json({ faq }, { status: 201 });
}
