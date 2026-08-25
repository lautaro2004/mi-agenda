import { NextResponse } from "next/server";

import { getSuperadminSession } from "@/lib/auth/superadmin";
import { leadUpdateSchema } from "@/lib/schemas";
import { getLeadDetail, updateLead } from "@/modules/leads/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const lead = await getLeadDetail(id);
  if (!lead) {
    return NextResponse.json({ error: "Lead no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ lead });
}

// Único punto de escritura de seguimiento (sección 7 del pedido: marcar
// contactado/reunión/propuesta/convertido/perdido, notas, fecha de reunión
// — todo por acá, un solo PATCH). Nunca acepta name/email/goals/etc: ese es
// el contacto original, leadUpdateSchema ni los tiene como campos.
export async function PATCH(request: Request, { params }: RouteParams) {
  const admin = await getSuperadminSession();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = leadUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  let meetingAt: Date | null | undefined;
  if (parsed.data.meetingAt !== undefined) {
    meetingAt = parsed.data.meetingAt ? new Date(parsed.data.meetingAt) : null;
    if (meetingAt && Number.isNaN(meetingAt.getTime())) {
      return NextResponse.json({ error: "Fecha de reunión inválida." }, { status: 400 });
    }
  }

  const lead = await updateLead(id, {
    status: parsed.data.status,
    notes: parsed.data.notes,
    meetingAt,
    convertedBusinessId:
      parsed.data.convertedBusinessId !== undefined ? parsed.data.convertedBusinessId || null : undefined,
  });

  if (!lead) {
    return NextResponse.json({ error: "Lead no encontrado." }, { status: 404 });
  }
  return NextResponse.json({ lead });
}
