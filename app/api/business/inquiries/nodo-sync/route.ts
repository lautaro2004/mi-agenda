import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/modules/business/current";
import { syncInquiryToNodo, type NodoSyncStatus } from "@/modules/inquiries/nodo-sync";

const MAX_IDS = 50;
const bodySchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(MAX_IDS) });

// Envía a Nodo CRM los interesados que el dueño eligió en Consultas. Solo
// admin; solo consultas del propio negocio (los ids ajenos se ignoran y se
// informan como "not_found"). No duplica: Nodo deduplica por email / teléfono.
// El resultado es real por id (synced / error / held / ...), nunca un éxito global.
export async function POST(request: Request) {
  const businessId = await getCurrentBusinessId({ minRole: "admin" });
  if (!businessId) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: `Elegí entre 1 y ${MAX_IDS} consultas.` }, { status: 400 });
  }
  const ids = [...new Set(parsed.data.ids)];

  const owned = await prisma.inquiry.findMany({ where: { businessId, id: { in: ids } }, select: { id: true } });
  const ownedIds = new Set(owned.map((i) => i.id));

  const results: Array<{ id: string; status: NodoSyncStatus | "not_found" }> = [];
  for (const id of ids) {
    if (!ownedIds.has(id)) {
      results.push({ id, status: "not_found" });
      continue;
    }
    results.push({ id, status: await syncInquiryToNodo(businessId, id) });
  }

  const summary = {
    synced: results.filter((r) => r.status === "synced").length,
    failed: results.filter((r) => r.status === "error").length,
    held: results.filter((r) => r.status === "held").length,
    other: results.filter((r) => !["synced", "error", "held"].includes(r.status)).length,
  };
  return NextResponse.json({ results, summary });
}
