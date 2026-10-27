import { NextResponse } from "next/server";

import { getPublicBusinessIdBySlug } from "@/modules/business/slug";
import { getClientIp, isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { getBusinessState } from "@/modules/business/service";
import { getAvailableSlots } from "@/modules/appointments/service";
import { getSmartAvailability } from "@/modules/smart-booking/booking";

// Contraparte pública de /api/appointments/availability: mismo motor
// (getAvailableSlots), resolviendo el negocio por slug en vez de por sesión
// — no hay usuario logueado en el sitio público. Ver el widget de reserva en
// components/public-site/booking-widget.tsx.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const businessId = await getPublicBusinessIdBySlug(slug);
  if (!businessId) {
    return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
  }

  if (isRateLimited(`availability:${businessId}:${getClientIp(request)}`, 60, 60 * 1000)) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId") ?? undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
  }

  const { schedule, services } = await getBusinessState(businessId);

  // Agenda inteligente (solo planes que la incluyen): filtra y ordena según las
  // reglas del negocio. Sin el plan, o sin reglas activas, el resultado es
  // exactamente el de siempre. Las reglas solo pueden quitar horarios, nunca
  // agregar uno que el motor real no devolvió.
  const durationMinutes = services?.find((s) => s.id === serviceId)?.durationMinutes ?? 60;
  const smart = await getSmartAvailability({ businessId, date, schedule, serviceId, durationMinutes });
  if (smart) return NextResponse.json(smart);

  const slots = await getAvailableSlots(businessId, new Date(`${date}T00:00:00`), schedule, serviceId);
  return NextResponse.json({ slots });
}
