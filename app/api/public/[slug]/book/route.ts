import { NextResponse } from "next/server";

import { getPublicBusinessIdBySlug } from "@/modules/business/slug";
import { getBusinessState } from "@/modules/business/service";
import { createPublicBooking } from "@/modules/appointments/public-booking";
import { getClientIp, isRateLimited, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";
import { manualAppointmentSchema } from "@/lib/schemas";

// Reserva desde el sitio público. Mismo contrato (manualAppointmentSchema) y
// misma función (createAppointment) que usa el turno manual del dashboard —
// termina en el mismo tipo de Appointment que una reserva por WhatsApp o por
// dashboard, no en una entidad paralela. La decisión de estado (confirmado,
// seña, pendiente de aprobación) vive en createPublicBooking, compartida con
// el chat web con IA.
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

  const { business, services, schedule } = await getBusinessState(businessId);

  const result = await createPublicBooking({
    businessId,
    business,
    services,
    schedule,
    serviceId: parsed.data.serviceId,
    customerName: parsed.data.customerName,
    customerPhone: parsed.data.customerPhone,
    customerEmail: parsed.data.customerEmail || null,
    date: parsed.data.date,
    startTime: parsed.data.startTime,
    notes: parsed.data.notes,
    resourceId: parsed.data.resourceId,
  });

  if (!result.ok) {
    if (result.error === "service_unavailable") {
      return NextResponse.json({ error: "Ese servicio no está disponible para reservar." }, { status: 400 });
    }
    const message =
      result.error === "invalid_resource"
        ? "El recurso seleccionado no es válido."
        : "Ese horario ya no está disponible. Elegí otro.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json({ appointment: result.appointment, pendingApproval: result.pendingApproval }, { status: 201 });
}
