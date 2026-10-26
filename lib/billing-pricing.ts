// ── Precios del pack Nexo + Nodo ──────────────────────────────────────────
// Única lógica de "cuánto se ahorra con el pack": la usan el superadmin y la
// presentación comercial (nunca se recalcula en otro lado). Sin Prisma: se
// puede usar en cliente y servidor.
//
// Todo se calcula en CENTAVOS ENTEROS: 1999.90 + 2999.90 en float no da
// exactamente 4999.80, y un descuento mal redondeado en una página de
// precios es un problema comercial.
//
// Reglas:
// - Solo hay ahorro si existen los TRES precios del MISMO período (Nexo
//   individual, Nodo individual y pack). Si falta uno, "unavailable": no se
//   compara contra un precio inexistente.
// - Ahorro = Nexo + Nodo − pack.  % = ahorro / (Nexo + Nodo) × 100.
// - pack == suma → "no_discount"; pack > suma → "more_expensive" (aviso en
//   el superadmin, nunca se presenta como oferta).

export type PackSavings =
  | { status: "unavailable"; missing: ("nexo" | "crm" | "pack")[] }
  | {
      status: "discount" | "no_discount" | "more_expensive";
      individualTotal: number;
      pack: number;
      // Positivo solo en "discount".
      savings: number;
      // Con un decimal (ej. 15.5). 0 si no hay descuento.
      percent: number;
    };

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

export function computePackSavings(prices: { nexo: number | null; crm: number | null; pack: number | null }): PackSavings {
  const missing = (["nexo", "crm", "pack"] as const).filter((k) => prices[k] === null || prices[k] === undefined || prices[k]! <= 0);
  if (missing.length) return { status: "unavailable", missing: [...missing] };

  const individualCents = toCents(prices.nexo!) + toCents(prices.crm!);
  const packCents = toCents(prices.pack!);
  const savingsCents = individualCents - packCents;

  if (savingsCents === 0) {
    return { status: "no_discount", individualTotal: fromCents(individualCents), pack: fromCents(packCents), savings: 0, percent: 0 };
  }
  if (savingsCents < 0) {
    return { status: "more_expensive", individualTotal: fromCents(individualCents), pack: fromCents(packCents), savings: 0, percent: 0 };
  }
  // Porcentaje en décimas, redondeado (entero → sin error de float).
  const tenths = Math.round((savingsCents * 1000) / individualCents);
  return {
    status: "discount",
    individualTotal: fromCents(individualCents),
    pack: fromCents(packCents),
    savings: fromCents(savingsCents),
    percent: tenths / 10,
  };
}

interface PriceLike {
  interval: string;
  amount: number;
  active: boolean;
}

/** Precio ACTIVO de un plan para un período, o null. */
export function activePrice(prices: PriceLike[] | undefined, interval: "month" | "year"): number | null {
  const price = (prices ?? []).find((p) => p.interval === interval && p.active);
  return price && price.amount > 0 ? price.amount : null;
}

/** Ahorro de un pack para un período, a partir de sus planes de referencia. */
export function packSavingsFor(
  pack: { prices?: PriceLike[] },
  nexoPlan: { prices?: PriceLike[] } | null,
  crmPlan: { prices?: PriceLike[] } | null,
  interval: "month" | "year"
): PackSavings {
  return computePackSavings({
    nexo: nexoPlan ? activePrice(nexoPlan.prices, interval) : null,
    crm: crmPlan ? activePrice(crmPlan.prices, interval) : null,
    pack: activePrice(pack.prices, interval),
  });
}

export function formatMoney(amount: number, currency = "ARS"): string {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}

/** Tipo de oferta según sus productos (nunca por el nombre del plan). */
export function offerKind(products: string[]): "nexo" | "crm" | "pack" {
  const hasNexo = products.includes("nexo");
  const hasCrm = products.includes("crm");
  if (hasNexo && hasCrm) return "pack";
  return hasCrm ? "crm" : "nexo";
}
