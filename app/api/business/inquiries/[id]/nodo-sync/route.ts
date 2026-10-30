import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/modules/business/current";
import { syncInquiryToNodo } from "@/modules/inquiries/nodo-sync";

// Reintenta el envío de un interesado a Nodo (por ejemplo, si falló antes).
// No duplica: Nodo deduplica por email / teléfono y el interesado es siempre
// el mismo registro de Nexo. Solo se puede reintentar uno del propio negocio.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  const { id } = await params;

  const inquiry = await prisma.inquiry.findFirst({ where: { id, businessId }, select: { id: true } });
  if (!inquiry) return NextResponse.json({ error: "Consulta no encontrada." }, { status: 404 });

  const status = await syncInquiryToNodo(businessId, inquiry.id);
  return NextResponse.json({ status });
}
