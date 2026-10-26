import { NextResponse } from "next/server";

/**
 * Modo remoto: si WHATSAPP_WORKER_URL está definida, las sesiones y
 * conversaciones viven en el worker (whatsapp-worker/) y esta app solo hace
 * de proxy autenticado. Sin la variable, todo corre en este proceso como antes.
 */
export function workerUrl(): string | null {
  const url = process.env.WHATSAPP_WORKER_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

export function isRemoteWhatsApp(): boolean {
  return workerUrl() !== null;
}

export async function workerFetch(businessId: string, path: string, init: RequestInit = {}): Promise<Response> {
  const base = workerUrl();
  const secret = process.env.WHATSAPP_WORKER_SECRET;
  if (!base || !secret) throw new Error("El worker de WhatsApp no está configurado.");
  return fetch(`${base}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${secret}`,
      "x-business-id": businessId,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

/** Reenvía la respuesta JSON del worker tal cual (status incluido). */
export async function proxyJson(businessId: string, path: string, init: RequestInit = {}): Promise<NextResponse> {
  try {
    const upstream = await workerFetch(businessId, path, init);
    const data = await upstream.json().catch(() => ({}));
    return NextResponse.json(data, { status: upstream.status });
  } catch (error) {
    console.error("[whatsapp worker] No se pudo contactar al worker:", error);
    return NextResponse.json({ error: "El servicio de WhatsApp no está disponible. Probá de nuevo en unos minutos." }, { status: 503 });
  }
}
