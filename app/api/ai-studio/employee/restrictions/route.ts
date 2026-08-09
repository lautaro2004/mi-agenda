import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { createRestriction } from "@/modules/employee/profile";
import { employeeRestrictionSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = employeeRestrictionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de la restricción inválidos." }, { status: 400 });
  }

  const restriction = await createRestriction(businessId, parsed.data);
  return NextResponse.json({ restriction }, { status: 201 });
}
