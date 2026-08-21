// Único formateador de precio para el sitio público — reusado por las cards
// de servicio y por la hero booking card, para no tener dos criterios de
// formato (moneda/decimales) que puedan divergir.
const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return currencyFormatter.format(value);
}

// Para precios con moneda variable (Plan.currency) — usada por las cards de
// plan reales (ver components/subscription-plan-card.tsx). Nunca asume ARS:
// a diferencia de formatPrice(), la moneda viene siempre del dato real.
export function formatPriceInCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${new Intl.NumberFormat("es-AR").format(value)}`;
  }
}
