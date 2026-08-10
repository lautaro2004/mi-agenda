import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getResourceAvailabilityForSlot } from "@/modules/appointments/service";

// Desglose por recurso para un horario puntual (fecha+hora ya elegidos) — lo
// usa el diálogo de "Agendar turno" cuando el dueño quiere elegir un recurso
// a mano en vez de "asignar automáticamente". Si el servicio no usa
// recursos, devuelve una lista vacía (nada que elegir).
export async function GET(request: Request) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const startTime = searchParams.get("startTime");
  const serviceId = searchParams.get("serviceId");
  const excludeAppointmentId = searchParams.get("excludeAppointmentId") ?? undefined;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !startTime || !serviceId) {
    return NextResponse.json({ error: "Parámetros inválidos." }, { status: 400 });
  }

  const resources = await getResourceAvailabilityForSlot(
    businessId,
    serviceId,
    date,
    startTime,
    excludeAppointmentId
  );
  return NextResponse.json({ resources });
}
