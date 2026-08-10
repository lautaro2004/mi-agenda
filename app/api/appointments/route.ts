import { NextResponse } from "next/server";

import { createAppointment, getAppointments, getAppointmentStats, getAvailableSlots } from "@/modules/appointments/service";
import { getCurrentBusinessId } from "@/modules/business/current";
import { getBusinessState } from "@/modules/business/service";
import { manualAppointmentSchema } from "@/lib/schemas";

export async function GET(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statsOnly = searchParams.get("stats") === "1";

  try {
    if (statsOnly) {
      const stats = await getAppointmentStats(businessId);
      return NextResponse.json(stats);
    }

    const appointments = await getAppointments(businessId, {
      date: searchParams.get("date") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
    });

    return NextResponse.json({ appointments });
  } catch (error) {
    console.error("[Appointments API] GET error:", error);
    return NextResponse.json({ error: "Error al obtener turnos." }, { status: 500 });
  }
}

// Turno agendado manualmente desde el dashboard. Reutiliza createAppointment()
// tal cual — el mismo servicio que usa el Booking Flow de WhatsApp
// (modules/ai/booking/flow.ts) — así que el resultado es indistinguible de
// una reserva hecha por WhatsApp: mismo modelo, misma validación de
// conflicto, mismo estado inicial.
export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await request.json();
  const parsed = manualAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos de turno inválidos." }, { status: 400 });
  }

  const { serviceId, customerName, customerPhone, date, startTime, notes, resourceId } = parsed.data;

  try {
    const { business, services, schedule } = await getBusinessState(businessId);
    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      return NextResponse.json({ error: "El servicio seleccionado no existe." }, { status: 404 });
    }

    // Revalidación server-side justo antes de crear: el horario (o el
    // recurso puntual, si se eligió uno a mano) pudo haberse ocupado entre
    // que el dueño abrió el diálogo y confirmó. No confiamos en lo que ya
    // tenía cargado el frontend — createAppointment() vuelve a validar esto
    // mismo dentro de una transacción, esto es una salida temprana con un
    // mensaje más específico antes de llegar ahí.
    const stillAvailable = await getAvailableSlots(businessId, new Date(`${date}T00:00:00`), schedule, serviceId);
    if (!stillAvailable.includes(startTime)) {
      return NextResponse.json(
        { error: "Ese horario ya no está disponible. Elegí otro." },
        { status: 409 }
      );
    }

    const result = await createAppointment({
      businessId,
      businessName: business.name,
      serviceId: service.id,
      serviceName: service.name,
      customerName,
      customerPhone,
      date,
      startTime,
      durationMinutes: service.durationMinutes > 0 ? service.durationMinutes : 60,
      notes,
      resourceId: resourceId ?? null,
    });

    if ("error" in result) {
      const message =
        result.error === "invalid_resource"
          ? "El recurso seleccionado no es válido para este servicio."
          : "Ese horario ya no está disponible. Elegí otro.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    return NextResponse.json({ appointment: result.appointment }, { status: 201 });
  } catch (error) {
    console.error("[Appointments API] POST error:", error);
    return NextResponse.json({ error: "No pudimos agendar el turno. Intentá de nuevo." }, { status: 500 });
  }
}
