import type { BillingSubscriptionStatus } from "@/modules/billing/subscription";

// ── Mapping de estados Mercado Pago -> Nexo (Fase 4) ─────────────────────
// Único lugar que traduce entre los 4 estados reales de un preapproval
// (pending|authorized|paused|cancelled) y el vocabulario interno de
// Subscription.status (trialing|active|past_due|canceled|expired) — tanto
// checkout.ts (alta) como el webhook (route.ts) pasan por acá, nunca
// reimplementan el mapeo.
//
// - authorized -> active: cobro habilitado, plan operativo.
// - paused -> past_due: mismo criterio que ya usa resolveAiAccess para
//   past_due ("período de gracia", sigue con acceso) — un preapproval
//   pausado casi siempre es MP reintentando un cobro que falló, no una baja
//   definitiva.
// - cancelled -> canceled: baja definitiva confirmada por MP.
// - pending -> null: todavía no hay nada que reflejar. Un preapproval recién
//   creado con card_token_id nace "authorized" en el flujo que usamos (ver
//   subscriptions.ts) — "pending" solo puede llegar por una notificación
//   adelantada/fuera de orden antes de que exista Subscription para ese
//   external_reference, o para un tipo de pago que no usamos. El caller
//   decide qué hacer con null (normalmente: no tocar nada todavía).
// - trialing/expired nunca salen de acá: son estados 100% internos de Nexo
//   (trial nunca pasa por Mercado Pago; "expired" no tiene equivalente
//   directo en el vocabulario de preapproval) — ver
//   modules/billing/subscription.ts.
export type MercadoPagoPreapprovalStatus = "pending" | "authorized" | "paused" | "cancelled";

export function mapMercadoPagoStatus(mpStatus: string): BillingSubscriptionStatus | null {
  switch (mpStatus as MercadoPagoPreapprovalStatus) {
    case "authorized":
      return "active";
    case "paused":
      return "past_due";
    case "cancelled":
      return "canceled";
    case "pending":
    default:
      return null;
  }
}
