import { NextResponse } from "next/server";

import { getPublicBusinessIdBySlug } from "@/modules/business/slug";
import { getBusinessState } from "@/modules/business/service";
import { createAppointment } from "@/modules/appointments/service";
import { computeDepositAmount } from "@/modules/business/deposit";
import { getClientIp, isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { manualAppointmentSchema } from "@/lib/schemas";
import { isBookableService } from "@/lib/types";

// Reserva desde el sitio público. Mismo contrato (manualAppointmentSchema) y
// misma función (createAppointment) que usa el turno manual del dashboard —
// termina en el mismo tipo de Appointment que una reserva por WhatsApp o por
// dashboard, no en una entidad paralela. Igual que el Booking Flow de
// WhatsApp (ver modules/ai/booking/flow.ts): si el negocio pide seña, el
// turno nace en pending_payment en vez de confirmado — antes de esta
// función, esta ruta ignoraba por completo la configuración de seña y
// siempre confirmaba directo, algo que WhatsApp ya no hacía.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const businessId = await getPublicBusinessIdBySlug(slug);
  if (!businessId) {
    return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
  }

  // Crea filas reales (y notifica al dueño): sin sesión, necesita freno propio.
  if (isRateLimited(`book:${businessId}:${getClientIp(request)}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = manualAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los datos de la reserva." }, { status: 400 });
  }

  const { business, services } = await getBusinessState(businessId);
  const service = services.find((s) => s.id === parsed.data.serviceId);
  if (!service || !isBookableService(service)) {
    return NextResponse.json({ error: "Ese servicio no está disponible para reservar." }, { status: 400 });
  }

  const depositQuote = computeDepositAmount(business, service);

  const result = await createAppointment({
    businessId,
    businessName: business.name,
    serviceId: service.id,
    serviceName: service.name,
    customerName: parsed.data.customerName,
    customerPhone: parsed.data.customerPhone,
    date: parsed.data.date,
    startTime: parsed.data.startTime,
    durationMinutes: service.durationMinutes,
    notes: parsed.data.notes,
    resourceId: parsed.data.resourceId,
    status: depositQuote ? "pending_payment" : "confirmed",
    depositAmount: depositQuote?.depositAmount,
    totalAmount: depositQuote?.totalAmount,
    source: "customer",
  });

  if ("error" in result) {
    const message =
      result.error === "invalid_resource"
        ? "El recurso seleccionado no es válido."
        : "Ese horario ya no está disponible. Elegí otro.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json({ appointment: result.appointment }, { status: 201 });
}
