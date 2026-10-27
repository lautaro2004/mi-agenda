import { priceWithExtras, seatLimit } from "@/lib/billing-seats";
import { FxUnavailableError, convertToArs, getUsdArsRate, needsConversion } from "@/lib/fx";
import { prisma } from "@/lib/prisma";
import { updatePreapprovalAmount } from "@/modules/billing/mercadopago/subscriptions";

// ── Cambiar los usuarios extra de Nodo de una suscripción ─────────────────
// Solo para suscripciones creadas con monto dinámico (sin preapproval_plan,
// ver checkout.ts): es la única forma de cambiar el monto de un preapproval.
// El nuevo monto rige desde el PRÓXIMO cobro (sin prorrateo: no está definido
// comercialmente). El límite de usuarios cambia al instante.
//  - Bajar nunca elimina ni desactiva miembros: se rechaza si los usuarios
//    actuales (miembros + invitaciones pendientes) no entran en el nuevo
//    límite.
//  - Idempotente: pedir la cantidad que ya tiene no llama a Mercado Pago.

export type ChangeExtraUsersError =
  | "NOT_FOUND"
  | "NOT_SUPPORTED"
  | "INVALID"
  | "SEATS_IN_USE"
  | "FX_UNAVAILABLE"
  | "MERCADOPAGO_ERROR";

export type ChangeExtraUsersResult =
  | { ok: true; extraUsers: number; seatLimit: number; arsAmount: number; changed: boolean }
  | { ok: false; error: ChangeExtraUsersError; message: string };

const fail = (error: ChangeExtraUsersError, message: string): ChangeExtraUsersResult => ({ ok: false, error, message });

export async function changeExtraUsers(businessId: string, extraUsers: number): Promise<ChangeExtraUsersResult> {
  if (!Number.isInteger(extraUsers) || extraUsers < 0 || extraUsers > 500) {
    return fail("INVALID", "La cantidad de usuarios extra no es válida.");
  }
  const sub = await prisma.subscription.findUnique({ where: { businessId }, include: { plan: true, planPrice: true } });
  if (!sub) return fail("NOT_FOUND", "No encontramos tu suscripción.");

  const plan = sub.plan;
  const yearly = sub.billingInterval === "year";
  const extraUnit = yearly ? plan.extraUserYearlyPrice : plan.extraUserMonthlyPrice;
  if (
    sub.provider !== "mercadopago" ||
    !["active", "trialing"].includes(sub.status) ||
    !sub.providerSubscriptionId ||
    sub.arsAmount === null ||
    !plan.products.includes("crm") ||
    !plan.crmMaxUsers ||
    !extraUnit
  ) {
    return fail("NOT_SUPPORTED", "Tu suscripción no permite cambiar usuarios extra desde acá. Contactanos para ajustarla.");
  }
  if (extraUsers === sub.extraUsers) {
    return { ok: true, extraUsers, seatLimit: seatLimit(plan.crmMaxUsers, extraUsers), arsAmount: sub.arsAmount, changed: false };
  }

  const newLimit = seatLimit(plan.crmMaxUsers, extraUsers);
  const [members, pending] = await Promise.all([
    prisma.membership.count({ where: { businessId, products: { has: "crm" } } }),
    prisma.invitation.count({
      where: { businessId, products: { has: "crm" }, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);
  if (members + pending > newLimit) {
    return fail(
      "SEATS_IN_USE",
      `Hoy usás ${members + pending} usuario${members + pending === 1 ? "" : "s"} (miembros e invitaciones pendientes) y con este cambio el límite sería ${newLimit}. Quitá miembros o invitaciones primero.`
    );
  }

  const baseAmount = yearly ? (sub.planPrice?.amount ?? 0) : plan.monthlyPrice;
  const listCurrency = yearly ? (sub.planPrice?.currency ?? plan.currency) : plan.currency;
  const listAmount = priceWithExtras(baseAmount, extraUnit, extraUsers);

  let arsAmount = listAmount;
  let fxRate: number | null = null;
  let fxRateAt: Date | null = null;
  if (needsConversion(listCurrency)) {
    try {
      const quote = await getUsdArsRate();
      arsAmount = convertToArs(listAmount, quote.rate);
      fxRate = quote.rate;
      fxRateAt = new Date();
    } catch (error) {
      if (error instanceof FxUnavailableError) return fail("FX_UNAVAILABLE", "No pudimos obtener la cotización del dólar. Probá de nuevo en unos minutos.");
      throw error;
    }
  }

  try {
    await updatePreapprovalAmount(sub.providerSubscriptionId, arsAmount);
  } catch (error) {
    console.error(`[extra-users] Mercado Pago rechazó el cambio de monto (negocio ${businessId}):`, error instanceof Error ? error.message : error);
    return fail("MERCADOPAGO_ERROR", "No pudimos actualizar el débito en Mercado Pago. No se hizo ningún cambio.");
  }

  await prisma.subscription.update({
    where: { businessId },
    data: { extraUsers, arsAmount, ...(fxRate !== null ? { fxRate, fxRateAt } : {}) },
  });
  return { ok: true, extraUsers, seatLimit: newLimit, arsAmount, changed: true };
}
