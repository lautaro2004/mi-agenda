import { prisma } from "@/lib/prisma";

// Envío de un interesado (nexo.Inquiry) a Nodo CRM, cuando el negocio lo
// tiene. Nexo NO escribe en el schema `crm`: le avisa a Nodo qué consulta
// procesar y Nodo la lee de nexo.Inquiry y crea o actualiza el lead con su
// propia lógica de deduplicación (email / teléfono). Ver en Nodo
// app/api/internal/nexo-inquiry/route.ts.
//
// - Sin NODO_URL / NEXO_NODO_SYNC_SECRET configurados no se llama a nada: el
//   interesado queda guardado igual en Nexo (y Nodo lo puede traer con
//   "Sincronizar con Nexo").
// - Nunca lanza: el resultado queda en la propia fila (nodoLeadId,
//   nodoSyncedAt, nodoSyncError) para diagnóstico.
// - El secreto nunca se loguea.

const TIMEOUT_MS = 5_000;

export type NodoSyncStatus = "synced" | "no_workspace" | "not_configured" | "error";

export async function syncInquiryToNodo(businessId: string, inquiryId: string): Promise<NodoSyncStatus> {
  const base = process.env.NODO_URL?.replace(/\/$/, "");
  const secret = process.env.NEXO_NODO_SYNC_SECRET;
  if (!base || !secret) return "not_configured";

  let status: NodoSyncStatus = "error";
  let leadId: string | null = null;
  let error: string | null = null;
  try {
    const res = await fetch(`${base}/api/internal/nexo-inquiry`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify({ businessId, inquiryId }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => null)) as { outcome?: string; leadId?: string | null; error?: string } | null;
    if (res.ok && body?.outcome === "no_workspace") {
      status = "no_workspace";
    } else if (res.ok && body?.outcome) {
      status = "synced";
      leadId = body.leadId ?? null;
    } else {
      error = `Nodo respondió ${res.status}${body?.error ? `: ${String(body.error).slice(0, 120)}` : ""}`;
    }
  } catch (err) {
    error = err instanceof Error && err.name === "TimeoutError" ? "Nodo no respondió a tiempo" : "No se pudo contactar a Nodo";
  }

  if (status === "error") console.warn(`[inquiries/nodo] ${error} (inquiry ${inquiryId})`);

  // Solo se registra el resultado cuando hubo algo que registrar: sin Nodo
  // contratado la fila queda limpia.
  if (status !== "no_workspace") {
    await prisma.inquiry
      .update({
        where: { id: inquiryId },
        data:
          status === "synced"
            ? { nodoLeadId: leadId, nodoSyncedAt: new Date(), nodoSyncError: null }
            : { nodoSyncError: error },
      })
      .catch((e) => console.error("[inquiries/nodo] No se pudo guardar el resultado del envío:", e instanceof Error ? e.message : e));
  }
  return status;
}
