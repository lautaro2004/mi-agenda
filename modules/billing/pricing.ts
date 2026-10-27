import { priceWithExtras } from "@/lib/billing-seats";
import { comboChargeArs, comboNeedsRate, type PricePart } from "@/lib/combo-pricing";
import { FxUnavailableError, convertToArs, getUsdArsRate, needsConversion } from "@/lib/fx";
import { prisma } from "@/lib/prisma";

// ── Cálculo único de lo que se cobra ──────────────────────────────────────
// Lo usan la cotización, el checkout, el cambio de usuarios/plan y el reajuste
// por cotización: así todos coinciden, con plan común o con combo
// (Plan.comboDiscountPct, ver modules/billing/combo.ts). Devuelve siempre el
// monto en pesos que se debita; el precio de lista informativo va aparte.

export type Interval = "month" | "year";

export interface ChargePlan {
  id: string;
  monthlyPrice: number;
  currency: string;
  products: string[];
  extraUserMonthlyPrice?: number | null;
  extraUserYearlyPrice?: number | null;
  prices?: { interval: string; amount: number; currency: string; active: boolean }[];
  comboDiscountPct?: number | null;
  packNexoPlanId?: string | null;
  packCrmPlanId?: string | null;
}

export type ChargeError = "PRICE_NOT_AVAILABLE" | "EXTRA_USERS_NOT_AVAILABLE" | "FX_UNAVAILABLE";

export type ChargeResult =
  | {
      ok: true;
      arsAmount: number;
      /** Precio de lista (en su moneda). En un combo, el total en pesos. */
      listAmount: number;
      listCurrency: string;
      /** El monto en pesos depende de la cotización del dólar. */
      converted: boolean;
      rate?: number;
      rateAt?: Date;
      source?: string;
      combo?: { discountPct: number; subtotalArs: number; discountArs: number };
    }
  | { ok: false; error: ChargeError };

export const isComboPlan = (plan: { comboDiscountPct?: number | null }): boolean => typeof plan.comboDiscountPct === "number";

async function fetchRate() {
  return getUsdArsRate();
}

export async function computeCharge(plan: ChargePlan, interval: Interval, extraUsers: number): Promise<ChargeResult> {
  const extras = Math.max(0, Math.trunc(extraUsers));
  try {
    return isComboPlan(plan) ? await comboCharge(plan, interval, extras) : await singleCharge(plan, interval, extras);
  } catch (error) {
    if (error instanceof FxUnavailableError) return { ok: false, error: "FX_UNAVAILABLE" };
    throw error;
  }
}

async function singleCharge(plan: ChargePlan, interval: Interval, extras: number): Promise<ChargeResult> {
  const price = interval === "year" ? (plan.prices ?? []).find((p) => p.interval === "year" && p.active) : null;
  if (interval === "year" && !price) return { ok: false, error: "PRICE_NOT_AVAILABLE" };

  const extraUnit = interval === "year" ? plan.extraUserYearlyPrice : plan.extraUserMonthlyPrice;
  if (extras > 0 && (!plan.products.includes("crm") || !extraUnit || extraUnit <= 0)) return { ok: false, error: "EXTRA_USERS_NOT_AVAILABLE" };

  const listCurrency = price?.currency ?? plan.currency;
  const baseAmount = price?.amount ?? plan.monthlyPrice;
  const listAmount = extras > 0 ? priceWithExtras(baseAmount, extraUnit, extras) : baseAmount;

  if (!needsConversion(listCurrency)) return { ok: true, arsAmount: listAmount, listAmount, listCurrency, converted: false };
  const quote = await fetchRate();
  return {
    ok: true,
    arsAmount: convertToArs(listAmount, quote.rate),
    listAmount,
    listCurrency,
    converted: true,
    rate: quote.rate,
    rateAt: quote.asOf,
    source: quote.source,
  };
}

async function comboCharge(plan: ChargePlan, interval: Interval, extras: number): Promise<ChargeResult> {
  if (!plan.packNexoPlanId || !plan.packCrmPlanId) return { ok: false, error: "PRICE_NOT_AVAILABLE" };
  const [nexo, crm] = await Promise.all([
    prisma.plan.findUnique({ where: { id: plan.packNexoPlanId }, include: { prices: true } }),
    prisma.plan.findUnique({ where: { id: plan.packCrmPlanId }, include: { prices: true } }),
  ]);
  if (!nexo || !crm) return { ok: false, error: "PRICE_NOT_AVAILABLE" };

  const partOf = (p: typeof nexo): PricePart | null => {
    if (interval === "month") return p.monthlyPrice > 0 ? { amount: p.monthlyPrice, currency: p.currency } : null;
    const year = p.prices.find((x) => x.interval === "year" && x.active);
    return year ? { amount: year.amount, currency: year.currency } : null;
  };
  const nexoPart = partOf(nexo);
  const crmPart = partOf(crm);
  if (!nexoPart || !crmPart) return { ok: false, error: "PRICE_NOT_AVAILABLE" };

  // Los usuarios extra se toman del plan de Nodo, a precio de lista y en su moneda.
  const extraUnitAmount = interval === "year" ? crm.extraUserYearlyPrice : crm.extraUserMonthlyPrice;
  if (extras > 0 && (!extraUnitAmount || extraUnitAmount <= 0)) return { ok: false, error: "EXTRA_USERS_NOT_AVAILABLE" };
  const extraUnit: PricePart | null = extraUnitAmount && extraUnitAmount > 0 ? { amount: extraUnitAmount, currency: crmPart.currency } : null;

  const needsRate = comboNeedsRate({ nexo: nexoPart, crm: crmPart, extraUnit: extras > 0 ? extraUnit : null });
  const quote = needsRate ? await fetchRate() : null;
  const pct = plan.comboDiscountPct as number;
  const charge = comboChargeArs({ nexo: nexoPart, crm: crmPart, discountPct: pct, extraUsers: extras, extraUnit, rate: quote?.rate ?? null });
  return {
    ok: true,
    arsAmount: charge.totalArs,
    listAmount: charge.totalArs,
    listCurrency: "ARS",
    converted: quote !== null,
    ...(quote ? { rate: quote.rate, rateAt: quote.asOf, source: quote.source } : {}),
    combo: { discountPct: pct, subtotalArs: charge.subtotalArs, discountArs: charge.discountArs },
  };
}
