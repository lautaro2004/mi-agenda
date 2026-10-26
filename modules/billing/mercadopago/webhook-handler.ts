import {
  assignSubscription,
  getSubscriptionByPreapprovalId,
  getSubscriptionWithPlan,
  type BusinessSubscription,
} from "@/modules/billing/subscription";
import {
  classifyInstallment,
  getAuthorizedPayment,
  type AuthorizedPaymentSnapshot,
} from "@/modules/billing/mercadopago/authorized-payments";
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

export type WebhookAction =
  | "updated"
  | "skipped_pending"
  | "skipped_no_subscription"
  | "skipped_stale"
  | "acknowledged";

export type WebhookProcessResult =
  | { handled: true; duplicate: true }
  | { handled: true; duplicate: false; action: WebhookAction }
  | { handled: false; error: string };

export async function processMercadoPagoWebhook(notification: MercadoPagoNotification): Promise<WebhookProcessResult> {
  const isNew = await recordWebhookEventOnce(notification.id, notification.type);
  if (!isNew) return { handled: true, duplicate: true };

  if (notification.type === "subscription_authorized_payment") {
    return processAuthorizedPayment(notification.data.id);
  }
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
  // Solo el preapproval VIGENTE del negocio puede cambiar su estado. Una
  // notificación de un preapproval anterior (cambio de plan, un débito viejo
  // ya cancelado, eventos fuera de orden) no toca la suscripción actual.
  // Sin providerSubscriptionId (asignaciones viejas) se mantiene el
  // comportamiento de siempre.
  if (existing.providerSubscriptionId && existing.providerSubscriptionId !== preapproval.id) {
    return { handled: true, duplicate: false, action: "skipped_stale" };
  }
  // Un preapproval sigue "authorized" mientras MP reintenta una cuota
  // rechazada: eso NO es un pago al día. Si ya hay un atraso registrado
  // (pastDueSince), solo una cuota aprobada lo limpia (ver
  // processAuthorizedPayment), no esta notificación.
  const status = internalStatus === "active" && existing.pastDueSince ? "past_due" : internalStatus;
  const pastDueSince = status === "past_due" ? (existing.pastDueSince ?? new Date()) : existing.pastDueSince;
  const result = await assignSubscription(businessId, {
    planId: existing.planId,
    status,
    currentPeriodStart: existing.currentPeriodStart,
    currentPeriodEnd: preapproval.nextPaymentDate ? new Date(preapproval.nextPaymentDate) : existing.currentPeriodEnd,
    provider: "mercadopago",
    providerSubscriptionId: preapproval.id,
    mercadoPagoStatus: preapproval.status,
    mercadoPagoLastSyncedAt: new Date(),
    ...billingCarryOver(existing),
    ...(pastDueSince ? { pastDueSince } : {}),
  });

  if (!result.ok) {
    return { handled: false, error: `assignSubscription falló para el negocio ${businessId}: ${result.error}` };
  }

  return { handled: true, duplicate: false, action: "updated" };
}

// Precio/período contratado: se conservan en cada actualización (para
// assignSubscription, un campo ausente es null).
function billingCarryOver(existing: Pick<BusinessSubscription, "planPriceId" | "billingInterval">) {
  return {
    ...(existing.planPriceId ? { planPriceId: existing.planPriceId } : {}),
    ...(existing.billingInterval ? { billingInterval: existing.billingInterval } : {}),
  };
}

// ── Cuotas (subscription_authorized_payment) ─────────────────────────────
// - Aprobada → al día: status active, se limpia pastDueSince y el período
//   avanza a la próxima fecha de cobro del preapproval.
// - Rechazada / en reintentos → atraso: status past_due y pastDueSince se
//   fija UNA vez (un reintento o un webhook repetido no lo reinicia).
// - Programada / en proceso → nada que reflejar.
// Una cuota de un período anterior al actual (debit_date anterior a
// currentPeriodStart) es vieja: no hace retroceder el estado.
async function processAuthorizedPayment(authorizedPaymentId: string): Promise<WebhookProcessResult> {
  let installment;
  try {
    installment = await getAuthorizedPayment(authorizedPaymentId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido al consultar Mercado Pago.";
    return { handled: false, error: `No se pudo releer la cuota ${authorizedPaymentId}: ${message}` };
  }
  const outcome = classifyInstallment(installment);
  if (outcome === "pending") return { handled: true, duplicate: false, action: "acknowledged" };
  if (!installment.preapprovalId) {
    return { handled: false, error: `La cuota ${installment.id} no tiene preapproval_id.` };
  }

  // Busca por el preapproval vigente: si la cuota es de un preapproval que
  // ya no es el del negocio, no hay suscripción que tocar.
  const existing = await getSubscriptionByPreapprovalId(installment.preapprovalId);
  if (!existing) return { handled: true, duplicate: false, action: "skipped_no_subscription" };
  return applyInstallment(existing, installment);
}

// Aplica UNA cuota a la suscripción vigente. Compartida por el webhook y la
// conciliación (reconcile.ts): misma regla, se haya enterado Nexo por
// notificación o releyendo Mercado Pago. Idempotente: aplicar dos veces la
// misma cuota deja el mismo estado (pastDueSince no se reinicia, el período
// sale de la propia cuota/preapproval).
export async function applyInstallment(
  existing: BusinessSubscription,
  installment: AuthorizedPaymentSnapshot,
  now: Date = new Date()
): Promise<WebhookProcessResult> {
  const outcome = classifyInstallment(installment);
  if (outcome === "pending") return { handled: true, duplicate: false, action: "acknowledged" };
  if (!installment.preapprovalId) {
    return { handled: false, error: `La cuota ${installment.id} no tiene preapproval_id.` };
  }
  if (existing.status === "canceled" || existing.status === "expired") {
    return { handled: true, duplicate: false, action: "skipped_stale" };
  }
  if (installment.debitDate && existing.currentPeriodStart && installment.debitDate < existing.currentPeriodStart) {
    return { handled: true, duplicate: false, action: "skipped_stale" };
  }

  if (outcome === "paid") {
    let nextPaymentDate: Date | null = existing.currentPeriodEnd;
    try {
      const preapproval = await getPreapproval(installment.preapprovalId);
      if (preapproval.nextPaymentDate) nextPaymentDate = new Date(preapproval.nextPaymentDate);
    } catch {
      // Sin la próxima fecha igual se marca al día; la conciliación la completa.
    }
    const result = await assignSubscription(existing.businessId, {
      planId: existing.planId,
      status: "active",
      currentPeriodStart: installment.debitDate ?? now,
      currentPeriodEnd: nextPaymentDate,
      provider: "mercadopago",
      providerSubscriptionId: existing.providerSubscriptionId,
      mercadoPagoStatus: existing.mercadoPagoStatus,
      mercadoPagoLastSyncedAt: now,
      ...billingCarryOver(existing),
    });
    return result.ok
      ? { handled: true, duplicate: false, action: "updated" }
      : { handled: false, error: `assignSubscription falló para el negocio ${existing.businessId}: ${result.error}` };
  }

  const result = await assignSubscription(existing.businessId, {
    planId: existing.planId,
    status: "past_due",
    currentPeriodStart: existing.currentPeriodStart,
    currentPeriodEnd: existing.currentPeriodEnd,
    provider: "mercadopago",
    providerSubscriptionId: existing.providerSubscriptionId,
    mercadoPagoStatus: existing.mercadoPagoStatus,
    mercadoPagoLastSyncedAt: now,
    pastDueSince: existing.pastDueSince ?? now,
    ...billingCarryOver(existing),
  });
  return result.ok
    ? { handled: true, duplicate: false, action: "updated" }
    : { handled: false, error: `assignSubscription falló para el negocio ${existing.businessId}: ${result.error}` };
}
