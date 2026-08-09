import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { createService } from "@/modules/business/service";
import { serviceSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = serviceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de servicio inválidos." }, { status: 400 });
  }

  const service = await createService(businessId, parsed.data);
  return NextResponse.json({ service }, { status: 201 });
}
