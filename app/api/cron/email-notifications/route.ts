import { NextResponse } from "next/server";

import { sendDailySummaries } from "@/modules/email/daily-summary";
import { sendDueReminders } from "@/modules/email/booking-emails";

// Mismo mecanismo que el resto de /api/cron/*: protegido con CRON_SECRET y
// pensado para un scheduler externo (ver .github/workflows/email-cron.yml,
// cada 10 minutos). En cada corrida: recordatorios de turno que ya entraron en
// su ventana y, si corresponde a la hora local, resúmenes diarios. Es
// idempotente: correrlo de más nunca duplica un email.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const reminders = await sendDueReminders();
  const dailySummaries = await sendDailySummaries();
  return NextResponse.json({ reminders, dailySummaries });
}
