import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { TICKET_STATUSES, listSupportTickets, type TicketStatus } from "@/modules/support/tickets";

// Lista de pedidos de ayuda (solo Superadmin).
export async function GET(request: Request) {
  const admin = await getSuperadminSession();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const raw = new URL(request.url).searchParams.get("status");
  const status = (TICKET_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as TicketStatus) : undefined;
  return NextResponse.json({ tickets: await listSupportTickets(status) });
}
