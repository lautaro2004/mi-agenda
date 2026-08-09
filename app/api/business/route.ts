import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getBusinessState, updateBusinessInfo } from "@/modules/business/service";
import { businessInfoSchema } from "@/lib/schemas";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const state = await getBusinessState(businessId);
  return NextResponse.json(state);
}

export async function PATCH(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = businessInfoSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de negocio inválidos." }, { status: 400 });
  }

  const business = await updateBusinessInfo(businessId, parsed.data);
  return NextResponse.json({ business });
}
