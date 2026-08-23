import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { getPaymentDetailForOwner } from "@/modules/payments/service";

// Siempre scopeado por businessId de la sesión — nunca se confía en que el
// :id del turno de la URL sea de este negocio sin volver a chequearlo (ver
// sección 11 de la tarea: un negocio nunca debe poder ver comprobantes de
// otro). getPaymentDetailForOwner ya hace ese filtro server-side.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const detail = await getPaymentDetailForOwner(businessId, id);
    if (!detail) {
      return NextResponse.json({ error: "Turno no encontrado." }, { status: 404 });
    }
    return NextResponse.json(detail);
  } catch (error) {
    console.error("[Appointment Payment API] GET error:", error);
    return NextResponse.json({ error: "No pudimos obtener el detalle del pago." }, { status: 500 });
  }
}
