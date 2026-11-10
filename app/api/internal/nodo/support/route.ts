import { NextResponse } from "next/server";
import { z } from "zod";

import { verifyNodoBillingRequest } from "@/modules/billing/nodo-internal";
import { createSupportTicket } from "@/modules/support/tickets";

const bodySchema = z.object({
  userId: z.string().min(1),
  subject: z.string().trim().max(120).optional(),
  message: z.string().trim().min(10, "Contanos un poco más (mínimo 10 caracteres).").max(2000, "El mensaje es demasiado largo."),
  pagePath: z.string().max(300).optional(),
  userAgent: z.string().max(300).optional(),
});

// Pedido de ayuda desde Nodo. Autenticación: el mismo secreto compartido que
// el resto de la API interna. El userId sale de la sesión de Nodo; el negocio
// se resuelve acá por la membresía (nunca viene del cliente).
export async function POST(request: Request) {
  const denied = verifyNodoBillingRequest(request);
  if (denied) return denied;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
  }

  const result = await createSupportTicket({ ...parsed.data, product: "nodo" });
  if (!result.ok) {
    if (result.error === "RATE_LIMITED") {
      return NextResponse.json({ error: "RATE_LIMITED", message: "Mandaste varios pedidos seguidos. Probá de nuevo en un rato." }, { status: 429 });
    }
    return NextResponse.json({ error: "NO_BUSINESS", message: "No encontramos tu negocio." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, id: result.id });
}
