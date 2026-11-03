import { NextResponse } from "next/server";
import { z } from "zod";

import { isValidTimeZone } from "@/lib/time-zone";
import { getCurrentBusinessId } from "@/modules/business/current";
import { getBusinessTimeZone, setBusinessTimeZone } from "@/modules/business/time-zone";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json({ timeZone: await getBusinessTimeZone(businessId) });
}

const bodySchema = z.object({ timeZone: z.string().refine(isValidTimeZone, "Zona horaria inválida") });

export async function PATCH(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Zona horaria inválida." }, { status: 400 });
  const ok = await setBusinessTimeZone(businessId, parsed.data.timeZone);
  if (!ok) return NextResponse.json({ error: "No pudimos guardar la zona horaria." }, { status: 500 });
  return NextResponse.json({ timeZone: parsed.data.timeZone });
}
