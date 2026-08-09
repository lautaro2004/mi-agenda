import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getEmployeeProfile, updateEmployeeProfile } from "@/modules/employee/profile";
import { employeeProfileSchema } from "@/lib/schemas";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const employee = await getEmployeeProfile(businessId);
  return NextResponse.json({ employee });
}

export async function PATCH(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = employeeProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos del empleado inválidos." }, { status: 400 });
  }

  const employee = await updateEmployeeProfile(businessId, parsed.data);
  return NextResponse.json({ employee });
}
