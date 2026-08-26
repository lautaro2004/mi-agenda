import type { BusinessSubscription } from "@/modules/billing/subscription";
import { assignSubscription, getPlanById, getSubscriptionWithPlan } from "@/modules/billing/subscription";
import { createPreapproval } from "@/modules/billing/mercadopago/subscriptions";
import { mapMercadoPagoStatus } from "@/modules/billing/mercadopago/status-map";

// ── Contratación (Fase 3) ─────────────────────────────────────────────────
// Único punto que crea un preapproval real en Mercado Pago. Reutiliza
// assignSubscription() para el efecto sobre Nexo — nunca escribe
// prisma.subscription directamente acá.

export type CheckoutError =
  | "plan_not_found"
  | "plan_inactive"
  | "plan_not_synced"
  | "already_subscribed"
  | "mercadopago_error";

export interface CheckoutInput {
  businessId: string;
  planId: string;
  payerEmail: string;
  cardTokenId: string;
}

export type CheckoutResult =
  | { ok: true; subscription: BusinessSubscription; mercadoPagoStatus: string }
  | { ok: false; error: CheckoutError; message?: string };

export async function createSubscriptionCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const plan = await getPlanById(input.planId);
  if (!plan) return { ok: false, error: "plan_not_found" };
  if (!plan.active) return { ok: false, error: "plan_inactive" };
  // Gratis (monthlyPrice=0) tampoco tiene mercadoPagoPlanId — este chequeo
  // ya lo cubre, no hace falta un caso especial aparte: no tiene sentido
  // "contratar" Gratis vía Mercado Pago.
  if (!plan.mercadoPagoPlanId) return { ok: false, error: "plan_not_synced" };

  const existing = await getSubscriptionWithPlan(input.businessId);
  if (existing?.provider === "mercadopago" && existing.status === "active") {
    return { ok: false, error: "already_subscribed" };
  }

  let preapproval;
  try {
    preapproval = await createPreapproval({
      preapprovalPlanId: plan.mercadoPagoPlanId,
      payerEmail: input.payerEmail,
      cardTokenId: input.cardTokenId,
      // Alcanza con businessId: Subscription es 1:1 por negocio (businessId
      // @unique), así que no hace falta componer un id más largo para
      // identificar a qué Subscription de Nexo corresponde este preapproval.
      externalReference: input.businessId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido al crear la suscripción en Mercado Pago.";
    return { ok: false, error: "mercadopago_error", message };
  }

  // "NO activar el plan pago únicamente porque el usuario volvió desde
  // Mercado Pago. La activación definitiva depende del estado confirmado
  // por Mercado Pago" — acá no hay redirect (ver subscriptions.ts: el flujo
  // con plan asociado no lo tiene), pero el mismo principio aplica: solo se
  // otorga el Plan si la respuesta DIRECTA de la API de creación confirma
  // "authorized". Si Mercado Pago devolviera "pending" (no debería pasar con
  // card_token_id, pero no se asume), no se toca el Plan todavía — queda
  // para que lo resuelva el webhook (Fase 4) cuando MP confirme el estado.
  const internalStatus = mapMercadoPagoStatus(preapproval.status ?? "");
  if (!internalStatus) {
    return {
      ok: false,
      error: "mercadopago_error",
      message: `Mercado Pago devolvió un estado inesperado ("${preapproval.status}") — no se activó el plan todavía.`,
    };
  }

  const now = new Date();
  const result = await assignSubscription(input.businessId, {
    planId: input.planId,
    status: internalStatus,
    currentPeriodStart: now,
    currentPeriodEnd: null,
    provider: "mercadopago",
    providerSubscriptionId: preapproval.id,
    mercadoPagoStatus: preapproval.status,
    mercadoPagoLastSyncedAt: now,
  });

  if (!result.ok) {
    // No debería pasar (ya validamos active arriba), pero si el plan se
    // desactivó en la fracción de segundo entre ambos chequeos, no dejamos
    // un preapproval autorizado en Mercado Pago sin ningún reflejo en Nexo.
    return {
      ok: false,
      error: "mercadopago_error",
      message: `La suscripción se creó en Mercado Pago (${preapproval.id}) pero no pudo activarse en Nexo — contactar soporte.`,
    };
  }

  return { ok: true, subscription: result.subscription, mercadoPagoStatus: preapproval.status ?? "" };
}
