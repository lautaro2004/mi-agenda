import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getSiteSummary } from "@/modules/analytics/site-events";

export async function GET(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const raw = Number(new URL(request.url).searchParams.get("days"));
  const days = [7, 30, 90].includes(raw) ? raw : 30;
  return NextResponse.json({ summary: await getSiteSummary(businessId, days) });
}
