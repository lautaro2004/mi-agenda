import { convertToArs, needsConversion } from "@/lib/fx";

// ── Combo Nexo + Nodo ─────────────────────────────────────────────────────
// Un combo NO es un plan con precio propio: es un descuento sobre la suma de
// un plan de Nexo y uno de Nodo (ej. 20 %). Las partes pueden estar en monedas
// distintas (Nexo en pesos, Nodo en dólares), así que el monto en pesos se
// calcula con la cotización del momento: ARS(parte) = monto × dólar si la
// parte está en USD. El descuento se aplica sobre la SUMA de los dos planes;
// los usuarios extra de Nodo se suman a precio de lista, sin descuento.
// Módulo puro (sin base ni red): lo usan checkout, cotización y reajuste.

export const DEFAULT_COMBO_DISCOUNT_PCT = 20;

export interface PricePart {
  amount: number;
  currency: string;
}

const toCents = (value: number) => Math.round(value * 100);

function partToArs(part: PricePart, rate: number | null): number {
  if (!needsConversion(part.currency)) return part.amount;
  if (rate === null) throw new Error("Falta la cotización para convertir el combo.");
  return convertToArs(part.amount, rate);
}

/** ¿Alguna parte (o los extras) está en dólares? Define si hace falta la cotización. */
export function comboNeedsRate(parts: { nexo: PricePart; crm: PricePart; extraUnit?: PricePart | null }): boolean {
  return needsConversion(parts.nexo.currency) || needsConversion(parts.crm.currency) || (!!parts.extraUnit && needsConversion(parts.extraUnit.currency));
}

export interface ComboCharge {
  /** Suma de ambos planes sin descuento, en pesos. */
  subtotalArs: number;
  /** Descuento aplicado a esa suma, en pesos. */
  discountArs: number;
  extrasArs: number;
  totalArs: number;
}

export function comboChargeArs(input: {
  nexo: PricePart;
  crm: PricePart;
  discountPct: number;
  extraUsers?: number;
  extraUnit?: PricePart | null;
  rate: number | null;
}): ComboCharge {
  const pct = Math.min(100, Math.max(0, input.discountPct));
  const subtotal = toCents(partToArs(input.nexo, input.rate)) + toCents(partToArs(input.crm, input.rate));
  const discount = Math.round((subtotal * pct) / 100);
  const extras = Math.max(0, Math.trunc(input.extraUsers ?? 0));
  if (extras > 0 && !input.extraUnit) throw new Error("Este plan no admite usuarios extra.");
  const extrasCents = extras > 0 && input.extraUnit ? extras * toCents(partToArs(input.extraUnit, input.rate)) : 0;
  return {
    subtotalArs: subtotal / 100,
    discountArs: discount / 100,
    extrasArs: extrasCents / 100,
    totalArs: (subtotal - discount + extrasCents) / 100,
  };
}
