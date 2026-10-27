// Cotización USD → ARS para cobrar en pesos un precio de lista en dólares.
// Mercado Pago Argentina solo opera suscripciones en ARS: el USD del plan es
// una referencia, y al contratar (y en cada renovación) se convierte a pesos
// con el dólar oficial (BNA, punta vendedora).
//
// Dinero en centavos enteros: nunca se multiplica un float por otro float
// para armar el importe final.

export const REFERENCE_CURRENCIES = ["ARS", "USD"] as const;
export type ReferenceCurrency = (typeof REFERENCE_CURRENCIES)[number];

export function isSupportedCurrency(value: string): value is ReferenceCurrency {
  return (REFERENCE_CURRENCIES as readonly string[]).includes(value);
}

/** true si el precio de lista está en una moneda que hay que convertir a ARS. */
export function needsConversion(currency: string | null | undefined): boolean {
  return (currency ?? "ARS").toUpperCase() !== "ARS";
}

export interface FxRate {
  /** Pesos por 1 USD (venta oficial BNA). */
  rate: number;
  /** Cuándo la publicó la fuente (o cuándo la consultamos si no informa). */
  asOf: Date;
  source: string;
}

export class FxUnavailableError extends Error {
  constructor() {
    super("No pudimos obtener la cotización del dólar en este momento.");
    this.name = "FxUnavailableError";
  }
}

/** Convierte un importe de lista a pesos, redondeando al centavo. */
export function convertToArs(amount: number, rate: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || amount < 0 || rate <= 0) {
    throw new Error("Importe o cotización inválidos.");
  }
  const cents = Math.round(amount * 100);
  const rateMicros = Math.round(rate * 10_000); // 4 decimales
  return Math.round((cents * rateMicros) / 10_000) / 100;
}

/** Variación relativa entre dos importes (0.05 = 5%). */
export function relativeChange(previous: number, next: number): number {
  if (previous <= 0) return Infinity;
  return Math.abs(next - previous) / previous;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const STALE_OK_MS = 6 * 60 * 60 * 1000;
let cache: { value: FxRate; fetchedAt: number } | null = null;

async function fromDolarApi(): Promise<FxRate> {
  const res = await fetch("https://dolarapi.com/v1/dolares/oficial", { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!res.ok) throw new Error(`dolarapi ${res.status}`);
  const data = (await res.json()) as { venta?: number; fechaActualizacion?: string };
  if (typeof data.venta !== "number" || data.venta <= 0) throw new Error("dolarapi sin venta");
  return { rate: data.venta, asOf: data.fechaActualizacion ? new Date(data.fechaActualizacion) : new Date(), source: "dolarapi.com (oficial)" };
}

async function fromBluelytics(): Promise<FxRate> {
  const res = await fetch("https://api.bluelytics.com.ar/v2/latest", { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!res.ok) throw new Error(`bluelytics ${res.status}`);
  const data = (await res.json()) as { oficial?: { value_sell?: number }; last_update?: string };
  const sell = data.oficial?.value_sell;
  if (typeof sell !== "number" || sell <= 0) throw new Error("bluelytics sin venta");
  return { rate: sell, asOf: data.last_update ? new Date(data.last_update) : new Date(), source: "bluelytics (oficial)" };
}

/**
 * Dólar oficial vendedor. Cache de 10 min; si ambas fuentes fallan se usa la
 * última cotización conocida hasta 6 h (con el mismo proceso). Más viejo que
 * eso: FxUnavailableError — nunca se cobra con una cotización inventada.
 */
export async function getUsdArsRate(): Promise<FxRate> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.value;
  for (const source of [fromDolarApi, fromBluelytics]) {
    try {
      const value = await source();
      cache = { value, fetchedAt: now };
      return value;
    } catch (error) {
      console.warn("[fx] fuente de cotización falló:", error instanceof Error ? error.message : error);
    }
  }
  if (cache && now - cache.fetchedAt < STALE_OK_MS) return cache.value;
  throw new FxUnavailableError();
}

/** Solo para tests. */
export function __resetFxCache() {
  cache = null;
}
