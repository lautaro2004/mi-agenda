import { NextResponse } from "next/server";

import { trackingConfigSchema } from "@/lib/site-tracking";
import { getCurrentBusinessId } from "@/modules/business/current";
import { getTrackingConfig, saveTrackingConfig } from "@/modules/analytics/site-events";

export async function GET() {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  return NextResponse.json({ config: await getTrackingConfig(businessId) });
}

// Solo IDs validados por formato: nunca código ni scripts.
export async function PUT(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const parsed = trackingConfigSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }
  return NextResponse.json({ config: await saveTrackingConfig(businessId, parsed.data) });
}
