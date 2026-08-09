import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { replaceSchedule } from "@/modules/business/service";
import { scheduleSchema } from "@/lib/schemas";
import type { BusinessSchedule } from "@/lib/types";

export async function PUT(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = scheduleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Horario inválido." }, { status: 400 });
  }

  const schedule = await replaceSchedule(businessId, parsed.data as BusinessSchedule);
  return NextResponse.json({ schedule });
}
