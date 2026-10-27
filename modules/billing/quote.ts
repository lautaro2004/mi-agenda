import { priceWithExtras } from "@/lib/billing-seats";
import { FxUnavailableError, convertToArs, getUsdArsRate, needsConversion } from "@/lib/fx";
import { getPlanById } from "@/modules/billing/subscription";

// Cotización de una contratación (plan + período + usuarios extra). Todo se
// calcula con los precios persistidos; lo que se COBRA se recalcula igual en
// el checkout (esto es informativo y sirve para montar el formulario de tarjeta).
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
    }
  | { ok: false; status: number; error: string };

export async function getCheckoutQuote(input: { planId: string; interval?: "month" | "year"; extraUsers?: number }): Promise<CheckoutQuote> {
  const interval: "month" | "year" = input.interval === "year" ? "year" : "month";
  const plan = input.planId ? await getPlanById(input.planId) : null;
  if (!plan || !plan.active) return { ok: false, status: 404, error: "Plan no encontrado." };

  const price = interval === "year" ? (plan.prices ?? []).find((p) => p.interval === "year" && p.active) : null;
  if (interval === "year" && !price) return { ok: false, status: 404, error: "Ese período no está disponible." };

  const extras = Math.max(0, Math.trunc(input.extraUsers ?? 0));
  const extraUnit = interval === "year" ? plan.extraUserYearlyPrice : plan.extraUserMonthlyPrice;
  if (extras > 0 && (!plan.products.includes("crm") || !extraUnit || extraUnit <= 0)) {
    return { ok: false, status: 400, error: "Este plan no admite usuarios extra." };
  }

  const listCurrency = price?.currency ?? plan.currency;
  const baseAmount = price?.amount ?? plan.monthlyPrice;
  const listAmount = extras > 0 ? priceWithExtras(baseAmount, extraUnit, extras) : baseAmount;
  const common = { ok: true as const, planName: plan.name, interval, extraUsers: extras, listCurrency, listAmount };

  if (!needsConversion(listCurrency)) return { ...common, converted: false, arsAmount: listAmount };
  try {
    const quote = await getUsdArsRate();
    return {
      ...common,
      converted: true,
      arsAmount: convertToArs(listAmount, quote.rate),
      rate: quote.rate,
      rateAt: quote.asOf.toISOString(),
      source: quote.source,
    };
  } catch (error) {
    if (error instanceof FxUnavailableError) {
      return { ok: false, status: 503, error: "No pudimos obtener la cotización del dólar. Probá de nuevo en unos minutos." };
    }
    throw error;
  }
}
