import { assignSubscription, getSubscriptionWithPlan } from "@/modules/billing/subscription";
import { getPreapproval } from "@/modules/billing/mercadopago/subscriptions";
import { mapMercadoPagoStatus } from "@/modules/billing/mercadopago/status-map";
import { recordWebhookEventOnce } from "@/modules/billing/mercadopago/webhook-events";

// ── Procesamiento del webhook (Fase 4) ────────────────────────────────────
// Separado de app/api/webhooks/mercadopago/route.ts a propósito: acá vive
// toda la lógica testeable (idempotencia, re-lectura, mapping, upsert);
// el route.ts solo se ocupa de validar la firma (necesita headers/query
// crudos de la request) y traducir el resultado a un status HTTP.
//
// Principio clave: el webhook NUNCA decide a qué Plan de Nexo corresponde
// una notificación — solo actualiza el status de la Subscription que YA
// existe para ese negocio (creada por checkout.ts en la contratación
// inicial). external_reference = businessId es la única correlación que usa
// (Subscription.businessId es @unique, así que no hace falta nada más
// específico). Esto respeta la regla principal: Mercado Pago es fuente de
// verdad de COBRO/ESTADO, Nexo sigue siendo el único que decide qué Plan
// implica eso.
export interface MercadoPagoNotification {
  id: string;
  type: string;
  data: { id: string };
}

export type WebhookAction = "updated" | "skipped_pending" | "skipped_no_subscription" | "acknowledged";

export type WebhookProcessResult =
  | { handled: true; duplicate: true }
  | { handled: true; duplicate: false; action: WebhookAction }
  | { handled: false; error: string };

export async function processMercadoPagoWebhook(notification: MercadoPagoNotification): Promise<WebhookProcessResult> {
  const isNew = await recordWebhookEventOnce(notification.id, notification.type);
  if (!isNew) return { handled: true, duplicate: true };

  if (notification.type !== "subscription_preapproval") {
    // subscription_authorized_payment (y cualquier otro topic futuro):
    // reconocido de forma idempotente, sin procesamiento propio todavía — un
    // cobro rechazado en un preapproval ya autorizado igual dispara MP un
    // subscription_preapproval con status "paused" a continuación, que sí se
    // procesa más abajo. Devolver 200 acá para que MP no reintente sin fin.
    return { handled: true, duplicate: false, action: "acknowledged" };
  }

  let preapproval;
  try {
    preapproval = await getPreapproval(notification.data.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido al consultar Mercado Pago.";
    return { handled: false, error: `No se pudo releer el preapproval ${notification.data.id}: ${message}` };
  }

  const businessId = preapproval.externalReference;
  if (!businessId) {
    return { handled: false, error: `El preapproval ${preapproval.id} no tiene external_reference.` };
  }

  // "pending" no tiene equivalente interno todavía (ver status-map.ts) — no
  // hay nada que reflejar, se corta acá sin tocar la Subscription.
  const internalStatus = mapMercadoPagoStatus(preapproval.status ?? "");
  if (!internalStatus) {
    return { handled: true, duplicate: false, action: "skipped_pending" };
  }

  const existing = await getSubscriptionWithPlan(businessId);
  if (!existing) {
    console.warn(
      `[mercadopago webhook] Preapproval ${preapproval.id} (status=${preapproval.status}) para negocio ${businessId} sin Subscription todavía — no se puede reflejar el estado sin una asignación de Plan previa (ver checkout.ts).`
    );
    return { handled: true, duplicate: false, action: "skipped_no_subscription" };
  }

  const result = await assignSubscription(businessId, {
    planId: existing.planId,
    status: internalStatus,
    currentPeriodStart: existing.currentPeriodStart,
    currentPeriodEnd: preapproval.nextPaymentDate ? new Date(preapproval.nextPaymentDate) : existing.currentPeriodEnd,
    provider: "mercadopago",
    providerSubscriptionId: preapproval.id,
    mercadoPagoStatus: preapproval.status,
    mercadoPagoLastSyncedAt: new Date(),
  });

  if (!result.ok) {
    return { handled: false, error: `assignSubscription falló para el negocio ${businessId}: ${result.error}` };
  }

  return { handled: true, duplicate: false, action: "updated" };
}
