import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { updateInquiryStatus } from "@/modules/inquiries/service";
import { inquiryStatusUpdateSchema } from "@/lib/schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = inquiryStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  }

  const { id } = await params;
  const updated = await updateInquiryStatus(businessId, id, parsed.data.status);
  if (!updated) {
    return NextResponse.json({ error: "Consulta no encontrada." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
