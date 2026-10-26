// ── Acceso por producto según la suscripción (Nexo + Nodo) ────────────────
// Función PURA (sin Prisma ni I/O): la usan el servidor de Nexo, sus tests y
// —copiada tal cual, con los mismos tests— Nodo (crm/lib/billing-access.ts),
// que no puede importar código de este repo. Si cambia acá, cambia allá.
// Ver docs/architecture/facturacion-nexo-nodo.md.
//
// Reglas (decisiones comerciales confirmadas):
// - Activa o en prueba vigente, con el producto en el plan → acceso normal.
// - Pago atrasado: 7 días de gracia con acceso normal (y avisos), contados
//   desde `pastDueSince` (persistido; un webhook repetido no lo reinicia).
//   Vencida la gracia → bloqueado.
// - Cancelada: acceso hasta el fin del período ya pagado (currentPeriodEnd);
//   después, bloqueado. Una cancelación NO es una baja inmediata.
// - Vencida, prueba vencida, sin suscripción o producto fuera del plan →
//   bloqueado. Bloquear nunca borra datos.
// - Si el cobro recurrente no se renovó y el webhook nunca llegó (la fecha
//   del próximo cobro quedó atrás por más de RENEWAL_TOLERANCE_DAYS), se
//   trata como atraso desde esa fecha: la regla funciona aunque falten
//   notificaciones (el cron de conciliación lo corrige en la base).

export const PRODUCTS = ["nexo", "crm"] as const;
export type Product = (typeof PRODUCTS)[number];

export const PRODUCT_LABELS: Record<Product, string> = { nexo: "Nexo", crm: "Nodo" };

export const GRACE_DAYS = 7;
export const RENEWAL_TOLERANCE_DAYS = 3;
const DAY = 24 * 60 * 60 * 1000;

export interface AccessSubscription {
  status: string;
  provider: string | null;
  currentPeriodEnd: Date | null;
  pastDueSince: Date | null;
  // Última vez que se supo algo de Mercado Pago (webhook o conciliación).
  // Si fue DESPUÉS de la fecha de cobro, no se infiere atraso: MP ya habló
  // y el estado persistido manda.
  mercadoPagoLastSyncedAt?: Date | null;
  plan: { products: string[] };
}

export type ProductAccess =
  | { access: "full"; reason: "active" | "trialing" | "canceled_until_period_end"; periodEndsAt: Date | null }
  | { access: "grace"; reason: "past_due"; pastDueSince: Date; graceEndsAt: Date }
  | {
      access: "blocked";
      reason: "no_subscription" | "not_in_plan" | "trial_expired" | "past_due_expired" | "canceled" | "expired";
      since: Date | null;
    };

export function planIncludes(plan: { products: string[] }, product: Product): boolean {
  return plan.products.includes(product);
}

/** Desde cuándo está atrasado (persistido, o inferido si nunca llegó el aviso). */
export function effectivePastDueSince(sub: AccessSubscription, now: Date): Date | null {
  if (sub.status === "past_due") return sub.pastDueSince ?? sub.currentPeriodEnd ?? now;
  if (
    sub.status === "active" &&
    sub.provider === "mercadopago" &&
    sub.currentPeriodEnd &&
    sub.currentPeriodEnd.getTime() + RENEWAL_TOLERANCE_DAYS * DAY < now.getTime() &&
    // Sin noticias de MP desde la fecha de cobro (webhook perdido).
    (!sub.mercadoPagoLastSyncedAt || sub.mercadoPagoLastSyncedAt <= sub.currentPeriodEnd)
  ) {
    return sub.pastDueSince ?? sub.currentPeriodEnd;
  }
  return null;
}

export function resolveProductAccess(sub: AccessSubscription | null, product: Product, now: Date = new Date()): ProductAccess {
  if (!sub) return { access: "blocked", reason: "no_subscription", since: null };
  if (!planIncludes(sub.plan, product)) return { access: "blocked", reason: "not_in_plan", since: null };

  const pastDueSince = effectivePastDueSince(sub, now);
  if (pastDueSince) {
    const graceEndsAt = new Date(pastDueSince.getTime() + GRACE_DAYS * DAY);
    return now < graceEndsAt
      ? { access: "grace", reason: "past_due", pastDueSince, graceEndsAt }
      : { access: "blocked", reason: "past_due_expired", since: graceEndsAt };
  }

  switch (sub.status) {
    case "active":
      return { access: "full", reason: "active", periodEndsAt: sub.currentPeriodEnd };
    case "trialing":
      return sub.currentPeriodEnd && sub.currentPeriodEnd <= now
        ? { access: "blocked", reason: "trial_expired", since: sub.currentPeriodEnd }
        : { access: "full", reason: "trialing", periodEndsAt: sub.currentPeriodEnd };
    case "canceled":
      return sub.currentPeriodEnd && sub.currentPeriodEnd > now
        ? { access: "full", reason: "canceled_until_period_end", periodEndsAt: sub.currentPeriodEnd }
        : { access: "blocked", reason: "canceled", since: sub.currentPeriodEnd };
    case "expired":
    default:
      return { access: "blocked", reason: "expired", since: sub.currentPeriodEnd };
  }
}

// ── Qué pasa al quedar "blocked", según el producto ─────────────────────
// - Nexo: NO se bloquea. Pasa al plan gratuito (Agenda interna) como acceso
//   EFECTIVO: el plan contratado, la configuración y los datos quedan
//   intactos y vuelven solos cuando se regulariza o se contrata de nuevo un
//   plan que los incluya (ver nexoPlan en modules/billing/subscription.ts).
// - Nodo: no tiene plan gratuito. Se bloquea el acceso funcional y se
//   muestra la pantalla de planes/regularización. Nada se borra.
export function hasProductAccess(result: ProductAccess): boolean {
  return result.access !== "blocked";
}
