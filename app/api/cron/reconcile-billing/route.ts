import { NextResponse } from "next/server";

import { reconcileMercadoPagoSubscriptions } from "@/modules/billing/mercadopago/reconcile";

// Conciliación con Mercado Pago (ver modules/billing/mercadopago/reconcile.ts).
// Mismo esquema que los demás crons: scheduler externo
// (.github/workflows/billing-cron.yml) + CRON_SECRET. Solo LEE Mercado Pago.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json(await reconcileMercadoPagoSubscriptions());
}
