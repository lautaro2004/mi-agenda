import { seatLimit } from "@/lib/billing-seats";
import { prisma } from "@/lib/prisma";
import { getOrCreateComboPlan } from "@/modules/billing/combo";
import { computeCharge } from "@/modules/billing/pricing";
import { updatePreapprovalAmount } from "@/modules/billing/mercadopago/subscriptions";
import { getPlanById } from "@/modules/billing/subscription";

// ── Cambiar de plan de Nodo (misma suscripción de Mercado Pago) ───────────
// Solo para suscripciones de monto dinámico (arsAmount definido, ver
// checkout.ts), igual que changeExtraUsers: es la única forma de cambiar el
// monto de un preapproval. Reglas:
//  - Mismo período (mensual/anual): cambiar el período exige otra suscripción.
//  - El plan nuevo rige al instante (permisos y límite de usuarios); el nuevo
//    monto se cobra desde el PRÓXIMO débito, sin prorrateo.
//  - Nunca elimina ni desactiva miembros: se rechaza si los usuarios actuales
//    (miembros + invitaciones pendientes) no entran en el límite del plan nuevo.
//  - Primero se actualiza Mercado Pago; si rechaza, no se toca nada local.
//  - Idempotente: pedir el plan y los extras que ya tiene no llama a MP.

export type ChangePlanError =
  | "NOT_FOUND"
  | "NOT_SUPPORTED"
  | "PLAN_NOT_AVAILABLE"
  | "EXTRA_USERS_NOT_AVAILABLE"
  | "SEATS_IN_USE"
  | "FX_UNAVAILABLE"
  | "MERCADOPAGO_ERROR";

export type ChangePlanResult =
  | { ok: true; planName: string; extraUsers: number; seatLimit: number; arsAmount: number; changed: boolean }
  | { ok: false; error: ChangePlanError; message: string };

const fail = (error: ChangePlanError, message: string): ChangePlanResult => ({ ok: false, error, message });

export async function changePlan(
  businessId: string,
  input: { planId: string; extraUsers?: number; withNexoPlanId?: string }
): Promise<ChangePlanResult> {
  const extras = Math.max(0, Math.min(500, Math.trunc(input.extraUsers ?? 0)));
  const sub = await prisma.subscription.findUnique({ where: { businessId }, include: { plan: true } });
  if (!sub) return fail("NOT_FOUND", "No encontramos tu suscripción.");

  const yearly = sub.billingInterval === "year";
  if (
    sub.provider !== "mercadopago" ||
    !["active", "trialing"].includes(sub.status) ||
    !sub.providerSubscriptionId ||
    sub.arsAmount === null
  ) {
    return fail("NOT_SUPPORTED", "Tu suscripción no permite cambiar de plan desde acá. Contactanos para ajustarla.");
  }

  // Combo: se suma un plan de Nexo al plan de Nodo elegido (con descuento).
  let targetId = input.planId;
  if (input.withNexoPlanId) {
    const combo = await getOrCreateComboPlan(input.withNexoPlanId, input.planId);
    if (!combo.ok) return fail("PLAN_NOT_AVAILABLE", "El combo elegido no está disponible.");
    targetId = combo.planId;
  }
  const target = await getPlanById(targetId);
  if (!target || !target.active || !target.products.includes("crm") || !target.crmMaxUsers) {
    return fail("PLAN_NOT_AVAILABLE", "El plan elegido no está disponible.");
  }
  const extraUnit = yearly ? target.extraUserYearlyPrice : target.extraUserMonthlyPrice;
  if (extras > 0 && (!extraUnit || extraUnit <= 0)) {
    return fail("EXTRA_USERS_NOT_AVAILABLE", "El plan elegido no admite usuarios extra.");
  }
  const price = yearly ? (target.prices ?? []).find((p) => p.interval === "year" && p.active) : null;

  if (target.id === sub.planId && extras === sub.extraUsers) {
    return { ok: true, planName: target.name, extraUsers: extras, seatLimit: seatLimit(target.crmMaxUsers, extras), arsAmount: sub.arsAmount, changed: false };
  }

  const newLimit = seatLimit(target.crmMaxUsers, extras);
  const [members, pending] = await Promise.all([
    prisma.membership.count({ where: { businessId, products: { has: "crm" } } }),
    prisma.invitation.count({
      where: { businessId, products: { has: "crm" }, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);
  if (members + pending > newLimit) {
    return fail(
      "SEATS_IN_USE",
      `Hoy usás ${members + pending} usuario${members + pending === 1 ? "" : "s"} (miembros e invitaciones pendientes) y ese plan permite ${newLimit}. Quitá miembros o invitaciones, o sumá usuarios extra.`
    );
  }

  const charge = await computeCharge(target, yearly ? "year" : "month", extras);
  if (!charge.ok) {
    if (charge.error === "FX_UNAVAILABLE") return fail("FX_UNAVAILABLE", "No pudimos obtener la cotización del dólar. Probá de nuevo en unos minutos.");
    if (charge.error === "EXTRA_USERS_NOT_AVAILABLE") return fail("EXTRA_USERS_NOT_AVAILABLE", "El plan elegido no admite usuarios extra.");
    return fail("PLAN_NOT_AVAILABLE", yearly ? "Ese plan no tiene precio anual. Para cambiar de período contactanos." : "El plan elegido no está disponible.");
  }
  const arsAmount = charge.arsAmount;
  const fxRate: number | null = charge.rate ?? null;
  const fxRateAt: Date | null = charge.rate !== undefined ? new Date() : null;

  try {
    await updatePreapprovalAmount(sub.providerSubscriptionId, arsAmount);
  } catch (error) {
    console.error(`[change-plan] Mercado Pago rechazó el cambio de monto (negocio ${businessId}):`, error instanceof Error ? error.message : error);
    return fail("MERCADOPAGO_ERROR", "No pudimos actualizar el débito en Mercado Pago. No se hizo ningún cambio.");
  }

  await prisma.subscription.update({
    where: { businessId },
    data: {
      planId: target.id,
      planPriceId: price ? price.id : null,
      extraUsers: extras,
      arsAmount,
      ...(fxRate !== null ? { fxRate, fxRateAt } : {}),
    },
  });
  return { ok: true, planName: target.name, extraUsers: extras, seatLimit: newLimit, arsAmount, changed: true };
}
