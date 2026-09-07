import { assignSubscription, getDefaultPlan, getSubscriptionWithPlan } from "@/modules/billing/subscription";
import { cancelPreapproval } from "@/modules/billing/mercadopago/subscriptions";
import { describeMercadoPagoError } from "@/modules/billing/mercadopago/errors";

// ── Cancelación (Fase 5) ───────────────────────────────────────────────────
// Único punto que cancela un preapproval real en Mercado Pago. Mismo
// criterio que checkout.ts: reutiliza assignSubscription() para el efecto
// sobre Nexo, nunca escribe prisma.subscription directamente.
//
// Al cancelar, el negocio vuelve a Gratis de inmediato (no queda un
// "Esencial cancelado" con las features del plan pago todavía visibles —
// resolvePlanFeatures() lee SOLO del Plan, nunca del status, así que dejar
// planId=Esencial con status="canceled" seguiría mostrando WhatsApp/señas/etc.
// habilitados). Mismo patrón que revertExpiredBenefits(): quien cancela cae
// al plan por defecto, no queda "flotando" en un plan pago sin cobro activo.
export type CancelSubscriptionError = "no_subscription" | "not_mercadopago" | "mercadopago_error" | "unexpected_error";

export interface CancelSubscriptionResult {
  code: CancelSubscriptionError;
  message: string;
  detail?: string;
}

export type CancelResult = { ok: true } | { ok: false; error: CancelSubscriptionResult };

const ERROR_MESSAGE: Record<CancelSubscriptionError, string> = {
  no_subscription: "No encontramos una suscripción para cancelar.",
  not_mercadopago: "Tu plan actual no se gestiona a través de Mercado Pago.",
  mercadopago_error: "No pudimos cancelar la suscripción en Mercado Pago.",
  unexpected_error: "No pudimos procesar la cancelación. Intentá de nuevo en unos minutos.",
};

function cancelError(code: CancelSubscriptionError, detail?: string): CancelResult {
  return { ok: false, error: { code, message: ERROR_MESSAGE[code], detail } };
}

export async function cancelSubscription(businessId: string): Promise<CancelResult> {
  try {
    return await runCancel(businessId);
  } catch (error) {
    console.error(
      `[cancel] Error inesperado cancelando la suscripción del negocio ${businessId}:`,
      error instanceof Error ? error.message : error
    );
    return cancelError("unexpected_error");
  }
}

async function runCancel(businessId: string): Promise<CancelResult> {
  const existing = await getSubscriptionWithPlan(businessId);
  if (!existing) return cancelError("no_subscription");
  if (existing.provider !== "mercadopago" || !existing.providerSubscriptionId) {
    return cancelError("not_mercadopago");
  }

  try {
    await cancelPreapproval(existing.providerSubscriptionId);
  } catch (error) {
    const info = describeMercadoPagoError(error);
    console.error(`[cancel] Mercado Pago rechazó la cancelación — negocio ${businessId}, preapproval ${existing.providerSubscriptionId}:`, {
      httpStatus: info.httpStatus,
      mpErrorSlug: info.mpErrorSlug,
      causes: info.causes,
      message: info.rawMessage,
    });
    return cancelError("mercadopago_error", info.detail);
  }

  // Mercado Pago ya confirmó la cancelación en este punto — de acá para
  // abajo solo falta reflejarlo en Nexo, nunca revertir lo ya cancelado.
  const defaultPlan = await getDefaultPlan();
  const now = new Date();
  const result = await assignSubscription(businessId, defaultPlan
    ? { planId: defaultPlan.id, status: "active", currentPeriodStart: now, currentPeriodEnd: null, provider: "manual" }
    // No debería pasar (mismo fallback que ensureTrialSubscription si el
    // plan Gratis no existiera), pero no dejamos el cobro ya cancelado sin
    // reflejar: al menos se apaga el vínculo con Mercado Pago sobre el plan
    // que tenía.
    : { planId: existing.planId, status: "canceled", currentPeriodStart: existing.currentPeriodStart, currentPeriodEnd: existing.currentPeriodEnd, provider: "manual" }
  );

  if (!result.ok) {
    console.error(`[cancel] Se canceló en Mercado Pago pero assignSubscription falló para el negocio ${businessId}: ${result.error}.`);
    return cancelError("unexpected_error");
  }

  return { ok: true };
}
