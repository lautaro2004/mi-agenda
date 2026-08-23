import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth/auth";
import { getCurrentBusinessId } from "@/modules/business/current";
import { rejectPayment } from "@/modules/payments/service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  const businessId = await getCurrentBusinessId();
  if (!session || !businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { reason?: string };

  try {
    const result = await rejectPayment({
      businessId,
      appointmentId: id,
      reviewedBy: session.user.email,
      reason: body.reason,
    });
    if ("error" in result) {
      const status = result.error === "not_found" ? 404 : 409;
      const message =
        result.error === "not_found"
          ? "Turno no encontrado."
          : "Este turno no tiene un comprobante pendiente de revisión.";
      return NextResponse.json({ error: message }, { status });
    }
    return NextResponse.json({ appointment: result.appointment, alreadyDone: result.alreadyDone });
  } catch (error) {
    console.error("[Appointment Payment Reject API] POST error:", error);
    return NextResponse.json({ error: "No pudimos rechazar el comprobante." }, { status: 500 });
  }
}
