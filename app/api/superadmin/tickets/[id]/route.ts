import { NextResponse } from "next/server";
import { z } from "zod";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { TICKET_STATUSES, updateSupportTicket } from "@/modules/support/tickets";

const bodySchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  adminNote: z.string().max(2000).nullable().optional(),
});

// Cambia el estado y/o la nota interna de un pedido (solo Superadmin).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getSuperadminSession();
  if (!admin) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const { id } = await params;
  const ok = await updateSupportTicket(id, parsed.data);
  if (!ok) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
