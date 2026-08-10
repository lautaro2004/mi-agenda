import { NextResponse } from "next/server";

import { getBusinessIdBySlug } from "@/modules/business/slug";
import { getBusinessState } from "@/modules/business/service";
import { getAvailableSlots } from "@/modules/appointments/service";

// Contraparte pública de /api/appointments/availability: mismo motor
// (getAvailableSlots), resolviendo el negocio por slug en vez de por sesión
// — no hay usuario logueado en el sitio público. Ver el widget de reserva en
// app/s/[slug]/booking-widget.tsx.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const businessId = await getBusinessIdBySlug(slug);
  if (!businessId) {
    return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId") ?? undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
  }

  const { schedule } = await getBusinessState(businessId);
  const slots = await getAvailableSlots(businessId, new Date(`${date}T00:00:00`), schedule, serviceId);

  return NextResponse.json({ slots });
}
