import { NextResponse } from "next/server";

import { repriceFxSubscriptions } from "@/modules/billing/mercadopago/reprice";

// Reajuste de los montos en pesos de los planes con precio de lista en USD
// (ver modules/billing/mercadopago/reprice.ts). Mismo esquema que los demás
// crons: scheduler externo (.github/workflows/billing-cron.yml) + CRON_SECRET.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return NextResponse.json(await repriceFxSubscriptions());
}
