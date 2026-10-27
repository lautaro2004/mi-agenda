import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// API interna Nodo → Nexo para contratar desde Nodo sin duplicar la lógica de
// Mercado Pago (la sigue haciendo Nexo, ver checkout.ts).
//
// Seguridad:
// - Secreto compartido NODO_BILLING_SECRET (Authorization: Bearer ...),
//   comparado en tiempo constante. Sin él configurado, responde 503.
// - El body NUNCA trae businessId, precio ni monto: trae el userId que Nodo
//   resolvió de su propia sesión; Nexo busca a qué negocio pertenece y exige
//   que sea el DUEÑO. Precios y montos salen de la base de Nexo.
export function verifyNodoBillingRequest(request: Request): NextResponse | null {
  const secret = process.env.NODO_BILLING_SECRET;
  if (!secret || secret.length < 24) {
    return NextResponse.json({ error: "NODO_BILLING_SECRET no configurado." }, { status: 503 });
  }
  const received = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  return null;
}

/** Negocio del usuario si es su dueño (un usuario pertenece a un solo negocio). */
export async function resolveOwnedBusiness(userId: string): Promise<string | null> {
  if (!userId) return null;
  const membership = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { businessId: true, role: true },
  });
  return membership && membership.role === "owner" ? membership.businessId : null;
}
