import { NextResponse, type NextRequest } from "next/server";
import { WebhookSignatureValidator, InvalidWebhookSignatureError } from "mercadopago";

import { processMercadoPagoWebhook, type MercadoPagoNotification } from "@/modules/billing/mercadopago/webhook-handler";

// ── POST /api/webhooks/mercadopago (Fase 4) ──────────────────────────────
// Validación de firma vía el validador que ya trae el SDK oficial (mismo
// algoritmo HMAC-SHA256 + comparación en tiempo constante que hubiésemos
// escrito a mano, pero sin reimplementarlo — ver auditoría inicial). Todo lo
// demás (idempotencia, re-lectura del preapproval, mapping, upsert) vive en
// webhook-handler.ts, testeable sin tocar HTTP.
export async function POST(request: NextRequest) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhooks/mercadopago] Falta MERCADOPAGO_WEBHOOK_SECRET — no se puede validar la firma, se rechaza la notificación.");
    return NextResponse.json({ error: "Webhook no configurado." }, { status: 500 });
  }

  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  const dataId = request.nextUrl.searchParams.get("data.id");

  try {
    WebhookSignatureValidator.validate({ xSignature, xRequestId, dataId, secret });
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      console.error(`[webhooks/mercadopago] Firma inválida (${error.reason}), request-id=${error.requestId ?? "?"}`);
      return NextResponse.json({ error: "Firma inválida." }, { status: 401 });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const notification = parseNotification(body);
  if (!notification) {
    // Payload con forma inesperada pero firma válida: no hay nada
    // procesable, pero tampoco es útil que MP siga reintentando lo mismo.
    console.error("[webhooks/mercadopago] Notificación con firma válida pero payload inesperado:", body);
    return NextResponse.json({ received: true });
  }

  const result = await processMercadoPagoWebhook(notification);

  if (!result.handled) {
    console.error(`[webhooks/mercadopago] ${result.error}`);
    // 500 a propósito: es una falla nuestra/de red hacia Mercado Pago (no un
    // problema de la notificación en sí) — MP reintenta automáticamente
    // notificaciones no confirmadas con 2xx, lo cual es justo lo que
    // queremos acá.
    return NextResponse.json({ error: "No se pudo procesar la notificación." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function parseNotification(body: unknown): MercadoPagoNotification | null {
  if (typeof body !== "object" || body === null) return null;
  const { id, type, data } = body as Record<string, unknown>;
  if (typeof id !== "string" && typeof id !== "number") return null;
  if (typeof type !== "string") return null;
  if (typeof data !== "object" || data === null) return null;
  const dataId = (data as Record<string, unknown>).id;
  if (typeof dataId !== "string" && typeof dataId !== "number") return null;

  return { id: String(id), type, data: { id: String(dataId) } };
}
