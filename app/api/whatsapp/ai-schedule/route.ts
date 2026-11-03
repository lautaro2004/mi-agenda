import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getBusinessTimeZone } from "@/modules/business/time-zone";
import { getAiSchedule, saveAiSchedule } from "@/modules/whatsapp/ai-schedule";

export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const [schedule, timeZone] = await Promise.all([getAiSchedule(businessId), getBusinessTimeZone(businessId)]);
  return NextResponse.json({ schedule, timeZone });
}

export async function PUT(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const saved = await saveAiSchedule(businessId, await request.json().catch(() => null));
  if (!saved) return NextResponse.json({ error: "Revisá los horarios: el inicio tiene que ser antes del fin." }, { status: 400 });
  return NextResponse.json({ schedule: saved });
}
