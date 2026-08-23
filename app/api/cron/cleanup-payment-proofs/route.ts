import { NextResponse } from "next/server";

import { cleanupOrphanPaymentProofs } from "@/modules/payments/service";

// Mismo mecanismo que cleanup-site-assets (ver ese archivo): protegido con
// CRON_SECRET, pensado para que lo invoque un scheduler externo. Solo borra
// comprobantes que NUNCA quedaron asociados a un turno (ver comentario en
// cleanupOrphanPaymentProofs) — nunca uno vinculado a una reserva, aunque
// esa reserva esté rechazada o cancelada, para no perder evidencia de pago.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const result = await cleanupOrphanPaymentProofs();
  return NextResponse.json(result);
}
