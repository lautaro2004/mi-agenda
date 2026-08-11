import { NextResponse } from "next/server";

import { cleanupOrphanSiteAssets } from "@/modules/business/assets";

// Sin infraestructura de cron propia en el proyecto todavía (ver sección 6
// de la tarea) — este endpoint queda preparado para que un scheduler externo
// (Netlify Scheduled Functions, cron-job.org, GitHub Actions, etc.) lo
// invoque periódicamente. Protegido con un secret de servidor: sin
// CRON_SECRET configurado, el endpoint queda inutilizable en vez de abierto.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET no configurado." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const result = await cleanupOrphanSiteAssets();
  return NextResponse.json(result);
}
