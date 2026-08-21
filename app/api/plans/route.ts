import { NextResponse } from "next/server";

import { getCurrentBusinessId } from "@/modules/business/current";
import { listActivePlans } from "@/modules/billing/subscription";

// Requiere sesión (mismo criterio que el resto de app/api/business/*) pero
// no devuelve nada específico de ESE negocio — son los planes que cualquier
// negocio logueado puede elegir. listActivePlans() ya filtra planes
// inactivos y no expone businessCount ni otros campos administrativos (ver
// modules/billing/subscription.ts) — eso queda exclusivo de
// /api/superadmin/planes.
export async function GET() {
  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const plans = await listActivePlans();
  return NextResponse.json({ plans });
}
