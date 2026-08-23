import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getCurrentBusinessId } from "@/modules/business/current";
import { confirmPayment } from "@/modules/payments/service";

// Idempotente (ver sección 9 de la tarea): confirmPayment() ya devuelve
// alreadyDone=true sin volver a tocar nada ni reenviar el WhatsApp de
// confirmación si se llama dos veces sobre el mismo turno.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const businessId = await getCurrentBusinessId();
  if (!session || !businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await confirmPayment({ businessId, appointmentId: id, reviewedBy: session.user.email });
    if ("error" in result) {
      const status = result.error === "not_found" ? 404 : 409;
      const message =
        result.error === "not_found"
          ? "Turno no encontrado."
          : "Este turno no está en un estado que permita confirmar el pago.";
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json({ appointment: result.appointment, alreadyDone: result.alreadyDone });
  } catch (error) {
    console.error("[Appointment Payment Confirm API] POST error:", error);
    return NextResponse.json({ error: "No pudimos confirmar el pago." }, { status: 500 });
  }
}
