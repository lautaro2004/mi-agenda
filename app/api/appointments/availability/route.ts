import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getBusinessState } from "@/modules/business/service";
import { getAvailableSlots } from "@/modules/appointments/service";

// Usado por el diálogo de "Agendar turno" del dashboard para saber qué
// horarios ofrecer. Reutiliza exactamente getAvailableSlots(), la misma
// función que usa el Booking Flow de WhatsApp (modules/ai/booking/flow.ts) —
// un solo motor de disponibilidad, no dos.
export async function GET(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId") ?? undefined;
  // Al reprogramar, el propio turno no debe contar como ocupando su horario
  // actual — ver getAvailableSlots().
  const excludeAppointmentId = searchParams.get("excludeAppointmentId") ?? undefined;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
  }

  const { schedule } = await getBusinessState(businessId);
  const slots = await getAvailableSlots(
    businessId,
    new Date(`${date}T00:00:00`),
    schedule,
    serviceId,
    excludeAppointmentId
  );

  return NextResponse.json({ slots });
}
