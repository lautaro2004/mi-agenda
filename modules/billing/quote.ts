import { computeCharge } from "@/modules/billing/pricing";
import { getPlanById } from "@/modules/billing/subscription";

// Cotización de una contratación (plan + período + usuarios extra, y opcionalmente
// un combo con un plan de Nexo). Todo se calcula con los precios persistidos y el
// MISMO cálculo que el checkout y el reajuste (modules/billing/pricing.ts); lo que
// se COBRA se recalcula igual en el checkout (esto es informativo y sirve para
// montar el formulario de tarjeta).
export type CheckoutQuote =
  | {
      ok: true;
      planName: string;
      interval: "month" | "year";
      extraUsers: number;
      converted: boolean;
      listCurrency: string;
      listAmount: number;
      arsAmount: number;
      rate?: number;
      rateAt?: string;
      source?: string;
      /** Solo en combos: el descuento aplicado sobre la suma de ambos planes. */
      combo?: { discountPct: number; subtotalArs: number; discountArs: number };
    }
  | { ok: false; status: number; error: string };

export async function getCheckoutQuote(input: {
  planId: string;
  interval?: "month" | "year";
  extraUsers?: number;
  /** Combo: plan de Nexo a sumar al plan de Nodo (planId). */
  withNexoPlanId?: string;
}): Promise<CheckoutQuote> {
  const interval: "month" | "year" = input.interval === "year" ? "year" : "month";

  let plan = input.planId ? await getPlanById(input.planId) : null;
  if (!plan || !plan.active) return { ok: false, status: 404, error: "Plan no encontrado." };

  // Combo: se cotiza contra un plan combinado "virtual" (los mismos datos que
  // tendrá el plan interno que crea el checkout), sin escribir nada.
  if (input.withNexoPlanId) {
    const { comboDiscountPct } = await import("@/modules/billing/combo");
    const nexo = await getPlanById(input.withNexoPlanId);
    if (!nexo || !nexo.active || nexo.products.length !== 1 || nexo.products[0] !== "nexo" || !(nexo.monthlyPrice > 0)) {
      return { ok: false, status: 404, error: "El plan de Nexo elegido no existe." };
    }
    if (plan.products.length !== 1 || plan.products[0] !== "crm") return { ok: false, status: 400, error: "Elegí un plan de Nodo para combinar." };
    plan = {
      ...plan,
      name: `${nexo.name} + ${plan.name}`,
      products: ["nexo", "crm"],
      monthlyPrice: 0,
      currency: "ARS",
      prices: [],
      packNexoPlanId: nexo.id,
      packCrmPlanId: plan.id,
      comboDiscountPct: comboDiscountPct(),
    };
  }

  const extras = Math.max(0, Math.trunc(input.extraUsers ?? 0));
  const charge = await computeCharge(plan, interval, extras);
  if (!charge.ok) {
    if (charge.error === "FX_UNAVAILABLE") {
      return { ok: false, status: 503, error: "No pudimos obtener la cotización del dólar. Probá de nuevo en unos minutos." };
    }
    if (charge.error === "EXTRA_USERS_NOT_AVAILABLE") return { ok: false, status: 400, error: "Este plan no admite usuarios extra." };
    return { ok: false, status: 404, error: interval === "year" ? "Ese período no está disponible." : "Plan no encontrado." };
  }

  return {
    ok: true,
    planName: plan.name,
    interval,
    extraUsers: extras,
    converted: charge.converted,
    listCurrency: charge.listCurrency,
    listAmount: charge.listAmount,
    arsAmount: charge.arsAmount,
    ...(charge.rate !== undefined ? { rate: charge.rate, rateAt: charge.rateAt?.toISOString(), source: charge.source } : {}),
    ...(charge.combo ? { combo: charge.combo } : {}),
  };
}
