import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/types";
import { getLeadMetrics, listLeads } from "@/modules/leads/service";

function parseStatus(value: string | null): LeadStatus | undefined {
  return LEAD_STATUSES.includes(value as LeadStatus) ? (value as LeadStatus) : undefined;
}

function parseDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Único punto de LECTURA de leads para Superadmin — devuelve la lista y las
// 4 métricas del tablero en la misma respuesta (sección 6 del pedido), un
// solo round-trip para la pantalla que los muestra juntos.
export async function GET(request: Request) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const [leads, metrics] = await Promise.all([
    listLeads({
      status: parseStatus(searchParams.get("status")),
      suggestedPlan: searchParams.get("plan")?.trim() || undefined,
      industry: searchParams.get("industry")?.trim() || undefined,
      q: searchParams.get("q")?.trim() || undefined,
      from: parseDate(searchParams.get("from")),
      to: parseDate(searchParams.get("to")),
    }),
    getLeadMetrics(),
  ]);

  return NextResponse.json({ leads, metrics });
}
