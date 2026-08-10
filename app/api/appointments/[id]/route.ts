import { NextResponse } from "next/server";

import { cancelAppointment, rescheduleAppointment } from "@/modules/appointments/service";
import { rescheduleAppointmentSchema } from "@/lib/schemas";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = (await request.json()) as { action: "cancel" | "reschedule" } & Record<string, unknown>;

    if (body.action === "cancel") {
      const appointment = await cancelAppointment(id);
      return NextResponse.json({ appointment });
    }

    if (body.action === "reschedule") {
      const parsed = rescheduleAppointmentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Faltan parámetros para reprogramar." }, { status: 400 });
      }

      const result = await rescheduleAppointment({
        id,
        newDate: parsed.data.date,
        newStartTime: parsed.data.startTime,
        durationMinutes: parsed.data.durationMinutes,
        resourceId: parsed.data.resourceId,
      });

      // Nunca devolver 200 con una reprogramación que en realidad no pasó:
      // el frontend/WhatsApp dependen de este status para saber si mostrar
      // éxito o pedir que se elija otro horario/recurso.
      if ("error" in result) {
        if (result.error === "not_found") {
          return NextResponse.json({ error: "Turno no encontrado." }, { status: 404 });
        }
        const message =
          result.error === "invalid_resource"
            ? "El recurso seleccionado no es válido para este servicio."
            : "Ese horario ya no está disponible. Elegí otro.";
        return NextResponse.json({ error: message }, { status: 409 });
      }

      return NextResponse.json({ appointment: result.appointment });
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
