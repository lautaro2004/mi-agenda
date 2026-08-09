import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { setCapability } from "@/modules/employee/profile";
import { employeeCapabilitySchema } from "@/lib/schemas";
import { EMPLOYEE_CAPABILITIES, type EmployeeCapabilityKey } from "@/lib/types";

const CAPABILITY_KEYS = new Set<string>(EMPLOYEE_CAPABILITIES.map((c) => c.id));

export async function PATCH(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { key } = await params;
  if (!CAPABILITY_KEYS.has(key)) {
    return NextResponse.json({ error: "Capacidad desconocida." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = employeeCapabilitySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de la capacidad inválidos." }, { status: 400 });
  }

  const capability = await setCapability(businessId, key as EmployeeCapabilityKey, parsed.data.enabled);
  return NextResponse.json({ capability });
}
