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
