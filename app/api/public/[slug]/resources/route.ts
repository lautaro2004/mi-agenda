import { NextResponse } from "next/server";

import { getPublicBusinessIdBySlug } from "@/modules/business/slug";
import { getClientIp, isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getResourceAvailabilityForSlot } from "@/modules/appointments/service";

// Contraparte pública de /api/appointments/resources — mismo motor,
// resolviendo el negocio por slug.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const businessId = await getPublicBusinessIdBySlug(slug);
  if (!businessId) {
    return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
  }

  if (isRateLimited(`resources:${businessId}:${getClientIp(request)}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const startTime = searchParams.get("startTime");
  const serviceId = searchParams.get("serviceId");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !startTime || !serviceId) {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }

  const resources = await getResourceAvailabilityForSlot(businessId, serviceId, date, startTime);
  return NextResponse.json({ resources });
}
