import { NextResponse } from "next/server";

import { cancelAppointment, rescheduleAppointment } from "@/modules/appointments/service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = (await request.json()) as {
      action: "cancel" | "reschedule";
      date?: string;
      startTime?: string;
      durationMinutes?: number;
    };

    if (body.action === "cancel") {
      const appointment = await cancelAppointment(id);
      return NextResponse.json({ appointment });
    }

    if (body.action === "reschedule") {
      if (!body.date || !body.startTime || !body.durationMinutes) {
        return NextResponse.json({ error: "Faltan parámetros para reprogramar." }, { status: 400 });
      }
      const appointment = await rescheduleAppointment(id, body.date, body.startTime, body.durationMinutes);
      return NextResponse.json({ appointment });
    }

    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  } catch (error) {
    console.error("[Appointments API] PATCH error:", error);
    return NextResponse.json({ error: "Error al actualizar el turno." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const appointment = await cancelAppointment(id);
    return NextResponse.json({ appointment });
  } catch (error) {
    console.error("[Appointments API] DELETE error:", error);
    return NextResponse.json({ error: "Error al cancelar el turno." }, { status: 500 });
  }
}
