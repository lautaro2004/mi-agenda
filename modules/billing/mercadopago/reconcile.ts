import { prisma } from "@/lib/prisma";
import { RENEWAL_TOLERANCE_DAYS } from "@/lib/billing-access";
import { assignSubscription, getSubscriptionWithPlan } from "@/modules/billing/subscription";
import { getPreapproval } from "@/modules/billing/mercadopago/subscriptions";
import { mapMercadoPagoStatus } from "@/modules/billing/mercadopago/status-map";
import { latestDecisiveInstallment, searchAuthorizedPayments } from "@/modules/billing/mercadopago/authorized-payments";
import { applyInstallment } from "@/modules/billing/mercadopago/webhook-handler";
import { isMercadoPagoConfigured } from "@/modules/billing/mercadopago/client";

// ── Conciliación con Mercado Pago (red de seguridad del webhook) ──────────
// Los webhooks pueden llegar tarde, desordenados o nunca. Este barrido
// relee desde la API de MP las suscripciones que necesitan una confirmación
// — fecha de cobro ya pasada, o un atraso abierto — y aplica EXACTAMENTE la
// misma regla que el webhook (applyInstallment). Siempre deja
// mercadoPagoLastSyncedAt al día: así la inferencia "el webhook nunca llegó"
// de lib/billing-access.ts deja de aplicar una vez que MP respondió.
//
// Idempotente: correrlo varias veces sobre el mismo estado de MP no cambia
// nada. Nunca cancela ni crea nada en Mercado Pago: solo lee.

const DAY = 24 * 60 * 60 * 1000;
export const RECONCILE_BATCH = 50;

export interface ReconcileResult {
  checked: number;
  updated: number;
  errors: number;
}

export async function reconcileMercadoPagoSubscriptions(now: Date = new Date()): Promise<ReconcileResult> {
  if (!isMercadoPagoConfigured()) return { checked: 0, updated: 0, errors: 0 };

  // Fecha de cobro vencida hace más de unas horas (tiempo para que MP cobre
  // y notifique), o atraso abierto, o sin fecha conocida. Las más viejas
  // sin sincronizar primero.
  const dueBefore = new Date(now.getTime() - DAY / 4);
  const candidates = await prisma.subscription.findMany({
    where: {
      provider: "mercadopago",
      providerSubscriptionId: { not: null },
      status: { in: ["active", "past_due"] },
      OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { lt: dueBefore } }, { status: "past_due" }],
    },
    orderBy: { mercadoPagoLastSyncedAt: { sort: "asc", nulls: "first" } },
    take: RECONCILE_BATCH,
    select: { businessId: true },
  });

  let updated = 0;
  let errors = 0;
  for (const { businessId } of candidates) {
    try {
      if (await reconcileOne(businessId, now)) updated++;
    } catch (error) {
      errors++;
      console.error(`[billing reconcile] Negocio ${businessId}:`, error instanceof Error ? error.message : error);
    }
  }
  return { checked: candidates.length, updated, errors };
}

async function reconcileOne(businessId: string, now: Date): Promise<boolean> {
  const existing = await getSubscriptionWithPlan(businessId);
  if (!existing?.providerSubscriptionId) return false;

  const preapproval = await getPreapproval(existing.providerSubscriptionId);
  const mpStatus = mapMercadoPagoStatus(preapproval.status ?? "");
  const nextPaymentDate = preapproval.nextPaymentDate ? new Date(preapproval.nextPaymentDate) : null;

  // 1) Baja confirmada por MP (ej. tras 3 cuotas rechazadas): acceso hasta
  //    el fin del período ya pagado (lib/billing-access.ts), nada se borra.
  if (mpStatus === "canceled") {
    const result = await assignSubscription(businessId, {
      planId: existing.planId,
      status: "canceled",
      currentPeriodStart: existing.currentPeriodStart,
      currentPeriodEnd: existing.currentPeriodEnd,
      provider: "mercadopago",
      providerSubscriptionId: existing.providerSubscriptionId,
      mercadoPagoStatus: preapproval.status,
      mercadoPagoLastSyncedAt: now,
      ...(existing.planPriceId ? { planPriceId: existing.planPriceId } : {}),
      ...(existing.billingInterval ? { billingInterval: existing.billingInterval } : {}),
      ...(existing.pastDueSince ? { pastDueSince: existing.pastDueSince } : {}),
    });
    return result.ok;
  }

  // 2) Última cuota resuelta: misma regla que el webhook.
  const latest = latestDecisiveInstallment(await searchAuthorizedPayments(existing.providerSubscriptionId));
  if (latest) {
    const result = await applyInstallment(existing, latest, now);
    if (result.handled && !result.duplicate && result.action === "updated") return true;
  }

  // 3) Sin cuota decisiva nueva: al menos se registra que MP respondió y se
  //    actualiza la próxima fecha de cobro (corta la inferencia de atraso
  //    por "webhook nunca llegado" cuando el cobro sí está al día).
  const refreshed = await getSubscriptionWithPlan(businessId);
  if (!refreshed) return false;
  const periodEnd =
    nextPaymentDate && (!refreshed.currentPeriodEnd || nextPaymentDate > refreshed.currentPeriodEnd)
      ? nextPaymentDate
      : refreshed.currentPeriodEnd;
  // Solo si MP MISMO informa una próxima fecha de cobro ya vencida (pasada
  // la tolerancia) y no hay cuota que lo explique, se registra el atraso
  // desde esa fecha. Nunca a partir de la fecha vieja guardada en Nexo: una
  // suscripción sana para la que MP no informa fecha no se marca atrasada.
  const overdue =
    refreshed.status === "active" &&
    nextPaymentDate !== null &&
    nextPaymentDate.getTime() + RENEWAL_TOLERANCE_DAYS * DAY < now.getTime();
  const result = await assignSubscription(businessId, {
    planId: refreshed.planId,
    status: overdue ? "past_due" : refreshed.status,
    currentPeriodStart: refreshed.currentPeriodStart,
    currentPeriodEnd: periodEnd,
    provider: "mercadopago",
    providerSubscriptionId: refreshed.providerSubscriptionId,
    mercadoPagoStatus: preapproval.status,
    mercadoPagoLastSyncedAt: now,
    ...(refreshed.planPriceId ? { planPriceId: refreshed.planPriceId } : {}),
    ...(refreshed.billingInterval ? { billingInterval: refreshed.billingInterval } : {}),
    ...(overdue
      ? { pastDueSince: refreshed.pastDueSince ?? nextPaymentDate! }
      : refreshed.pastDueSince
        ? { pastDueSince: refreshed.pastDueSince }
        : {}),
  });
  return result.ok;
}
