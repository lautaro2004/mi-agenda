// Enmascara un valor para logs de diagnóstico — nunca expone más que los
// últimos 6 caracteres (alcanza para comparar contra el panel de Mercado
// Pago sin poder reconstruir la credencial ni el token). Puro, sin I/O:
// seguro de usar tanto en cliente (components/subscription-checkout-dialog.tsx)
// como en servidor (modules/billing/mercadopago/checkout.ts, client.ts).
export function maskTail(value: string | null | undefined): string {
  if (!value) return "(no configurado)";
  return value.length <= 6 ? `…${value}` : `…${value.slice(-6)}`;
}
