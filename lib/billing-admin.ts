// ── Lógica comercial del superadmin (pura, sin Prisma) ────────────────────
// Clasificación de una suscripción para mostrarla, bloqueo de operaciones
// manuales que pisarían un débito vivo, pérdida de productos al cambiar de
// plan y conteo de usuarios de Nodo. Se prueba sin base (billing-admin.test.ts)
// y la usan la lista y el detalle de Empresas.

export type BillingKind =
  | "none" // sin suscripción
  | "free" // plan gratuito (Agenda interna)
  | "trial" // prueba gratuita
  | "benefit" // bonificación temporal
  | "paid" // suscripción paga (Mercado Pago al día)
  | "manual" // asignada a mano / por código promocional, sin cobro automático
  | "past_due" // pago atrasado
  | "canceled"
  | "expired";

export const BILLING_KIND_LABEL: Record<BillingKind, string> = {
  none: "Sin suscripción",
  free: "Plan gratuito",
  trial: "Prueba gratuita",
  benefit: "Bonificación temporal",
  paid: "Suscripción paga",
  manual: "Asignado a mano",
  past_due: "Pago atrasado",
  canceled: "Cancelada",
  expired: "Vencida",
};

export interface ClassifyInput {
  status: string;
  provider: string | null;
  benefitExpiresAt: Date | null;
  isBasePlan: boolean;
}

export function classifySubscription(sub: ClassifyInput | null): BillingKind {
  if (!sub) return "none";
  if (sub.isBasePlan) return "free";
  switch (sub.status) {
    case "trialing":
      return "trial";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "expired":
      return "expired";
    case "active":
      if (sub.benefitExpiresAt) return "benefit";
      return sub.provider === "mercadopago" ? "paid" : "manual";
    default:
      return "expired";
  }
}

// ── Débito vivo ───────────────────────────────────────────────────────────
// assignSubscription() reemplaza la fila entera: asignar un plan a mano o dar
// una bonificación a quien tiene un débito automático en Mercado Pago pierde
// el vínculo con su preapproval, que SIGUE COBRANDO (doble cobro, o cobro de
// un plan que la empresa ya no tiene). Se bloquea hasta que el débito se
// cancele; el estado "canceled"/"expired" ya no cobra.
export function hasLiveMercadoPagoDebit(sub: { provider: string | null; status: string; providerSubscriptionId: string | null } | null): boolean {
  return !!sub && sub.provider === "mercadopago" && !!sub.providerSubscriptionId && sub.status !== "canceled" && sub.status !== "expired";
}

export const LIVE_DEBIT_MESSAGE =
  "Esta empresa tiene un débito automático activo en Mercado Pago. Cancelá la suscripción antes de asignar un plan a mano o una bonificación: si no, el débito seguiría cobrando.";

// ── Productos que se pierden al cambiar de plan ──────────────────────────
// Hay UNA suscripción por empresa: dar un plan "solo Nodo" a quien paga Nexo
// le quita su Nexo pago mientras dure (y a la inversa). Se avisa y se exige
// confirmación explícita.
export function productsLost(current: string[] | null | undefined, next: string[]): string[] {
  return (current ?? []).filter((p) => !next.includes(p));
}

export const PRODUCT_NAME: Record<string, string> = { nexo: "Nexo", crm: "Nodo" };

export function lostProductsMessage(lost: string[]): string {
  const names = lost.map((p) => PRODUCT_NAME[p] ?? p).join(" y ");
  return `Este plan no incluye ${names}: la empresa pierde ${names === "Nexo" ? "su plan de Nexo (Nexo pasa al plan gratuito)" : `el acceso a ${names}`} mientras dure.`;
}

// ── Usuarios de Nodo ──────────────────────────────────────────────────────
// Regla de conteo (la misma en Nexo y en Nodo):
// - Cuenta cada Membership del negocio con "crm" en `products`: una persona
//   con acceso a Nexo y Nodo es UNA fila, no se duplica. El dueño cuenta.
// - Una Membership no tiene estado inactivo: si existe, tiene acceso.
// - Las invitaciones pendientes con acceso a Nodo (sin aceptar, sin revocar,
//   sin vencer) RESERVAN lugar: se cuentan para no poder superar el límite
//   aceptándolas después, pero se muestran aparte.
// - Si el plan baja de límite, no se elimina a nadie: `over` es true y no se
//   permiten altas ni invitaciones hasta volver al límite.
export interface SeatUsage {
  limit: number;
  used: number;
  pending: number;
  reserved: number;
  remaining: number;
  // Hay más miembros con acceso que el límite del plan.
  over: boolean;
  // No se puede invitar ni dar acceso a otra persona.
  full: boolean;
}

export function computeSeatUsage(input: { limit: number; members: number; pendingInvites: number }): SeatUsage {
  const reserved = input.members + input.pendingInvites;
  return {
    limit: input.limit,
    used: input.members,
    pending: input.pendingInvites,
    reserved,
    remaining: Math.max(0, input.limit - reserved),
    over: input.members > input.limit,
    full: reserved >= input.limit,
  };
}
