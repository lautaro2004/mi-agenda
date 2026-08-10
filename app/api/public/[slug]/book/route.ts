import { NextResponse } from "next/server";

import { getBusinessIdBySlug } from "@/modules/business/slug";
import { getBusinessState } from "@/modules/business/service";
import { createAppointment } from "@/modules/appointments/service";
import { manualAppointmentSchema } from "@/lib/schemas";
import { isBookableService } from "@/lib/types";

// Reserva desde el sitio público. Mismo contrato (manualAppointmentSchema) y
// misma función (createAppointment) que usa el turno manual del dashboard —
// termina en el mismo tipo de Appointment que una reserva por WhatsApp o por
// dashboard, no en una entidad paralela.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const businessId = await getBusinessIdBySlug(slug);
  if (!businessId) {
    return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });
  }

  const body = await request.json();
  const parsed = manualAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Revisá los datos de la reserva." }, { status: 400 });
  }

  const { business, services } = await getBusinessState(businessId);
  const service = services.find((s) => s.id === parsed.data.serviceId);
  if (!service || !isBookableService(service)) {
    return NextResponse.json({ error: "Ese servicio no está disponible para reservar." }, { status: 400 });
  }

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
