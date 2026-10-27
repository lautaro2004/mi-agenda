import { prisma } from "@/lib/prisma";
import { BASE_PLAN_SLUG } from "@/lib/types";
import { offerKind } from "@/lib/billing-pricing";
import { seatLimit } from "@/lib/billing-seats";
import { classifySubscription, computeSeatUsage, type BillingKind, type SeatUsage } from "@/lib/billing-admin";
import type { ProductAccess } from "@/lib/billing-access";
import { getSubscriptionsWithPlanForBusinesses, type BusinessSubscription } from "@/modules/billing/subscription";

// ── Resumen de facturación por empresa (superadmin) ───────────────────────
// Una sola función arma lo que muestran la lista y el detalle de Empresas:
// qué contrató, cuánto, en qué estado de pago está, hasta cuándo tiene
// gracia, a qué productos accede HOY y cuántos usuarios de Nodo usa. Todo
// sale de los mismos datos persistidos y de resolveProductAccess (el acceso
// efectivo se calcula, nunca se guarda): lo que ve el superadmin es
// exactamente lo que el servidor aplica.

export interface AccessView {
  access: "full" | "grace" | "blocked";
  reason: string;
  // Gracia: hasta cuándo. Bloqueado por atraso: cuándo venció la gracia.
  graceEndsAt: string | null;
  periodEndsAt: string | null;
}

export interface BillingOverview {
  kind: BillingKind;
  offer: "nexo" | "crm" | "pack";
  planId: string;
  planName: string;
  planSlug: string;
  products: string[];
  status: string;
  provider: string | null;
  billingInterval: "month" | "year" | null;
  // Precio del período contratado. "contracted" = el de su PlanPrice (lo que
  // paga por Mercado Pago); "list" = precio de lista del plan (asignación a
  // mano, no hay cobro). null = sin precio (gratuito).
  amount: number | null;
  amountSource: "contracted" | "list" | null;
  currency: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  // true = currentPeriodEnd es la fecha del PRÓXIMO COBRO (débito automático
  // al día); false = es cuándo vence lo ya asignado/pagado.
  periodEndIsNextCharge: boolean;
  pastDueSince: string | null;
  graceEndsAt: string | null;
  nexoAccess: AccessView;
  crmAccess: AccessView;
  benefitExpiresAt: string | null;
  previousPlanName: string | null;
  mercadoPagoStatus: string | null;
  mercadoPagoLastSyncedAt: string | null;
  hasPreapproval: boolean;
  // null si el plan no incluye Nodo.
  crmSeats: SeatUsage | null;
}

function viewAccess(a: ProductAccess): AccessView {
  return {
    access: a.access,
    reason: a.reason,
    graceEndsAt: a.access === "grace" ? a.graceEndsAt.toISOString() : a.access === "blocked" && a.reason === "past_due_expired" ? (a.since?.toISOString() ?? null) : null,
    periodEndsAt: a.access === "full" ? (a.periodEndsAt?.toISOString() ?? null) : null,
  };
}

export function buildBillingOverview(
  sub: BusinessSubscription,
  extras: { priceAmount: number | null; previousPlanName: string | null; seatMembers: number; seatPending: number }
): BillingOverview {
  const plan = sub.plan;
  const isBasePlan = plan.slug === BASE_PLAN_SLUG;
  const kind = classifySubscription({ status: sub.status, provider: sub.provider, benefitExpiresAt: sub.benefitExpiresAt, isBasePlan });
  const interval = sub.billingInterval;
  const contracted = extras.priceAmount !== null;
  const amount = contracted ? extras.priceAmount : plan.monthlyPrice > 0 ? plan.monthlyPrice : null;
  const amountSource = amount === null ? null : contracted ? "contracted" : "list";
  const live = sub.provider === "mercadopago" && sub.status === "active";
  const grace = sub.nexoAccess.access === "grace" ? sub.nexoAccess : sub.crmAccess.access === "grace" ? sub.crmAccess : null;

  return {
    kind,
    offer: offerKind(plan.products),
    planId: plan.id,
    planName: plan.name,
    planSlug: plan.slug,
    products: plan.products,
    status: sub.status,
    provider: sub.provider,
    billingInterval: interval,
    amount,
    amountSource,
    currency: plan.currency,
    currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    periodEndIsNextCharge: live,
    pastDueSince: sub.pastDueSince?.toISOString() ?? null,
    graceEndsAt: grace && grace.access === "grace" ? grace.graceEndsAt.toISOString() : null,
    nexoAccess: viewAccess(sub.nexoAccess),
    crmAccess: viewAccess(sub.crmAccess),
    benefitExpiresAt: sub.benefitExpiresAt?.toISOString() ?? null,
    previousPlanName: extras.previousPlanName,
    mercadoPagoStatus: sub.mercadoPagoStatus,
    mercadoPagoLastSyncedAt: sub.mercadoPagoLastSyncedAt?.toISOString() ?? null,
    hasPreapproval: !!sub.providerSubscriptionId,
    crmSeats: plan.products.includes("crm") && plan.crmMaxUsers
      ? computeSeatUsage({ limit: seatLimit(plan.crmMaxUsers, sub.extraUsers), members: extras.seatMembers, pendingInvites: extras.seatPending })
      : null,
  };
}

/** Resumen para varias empresas, con pocas consultas (lista de Empresas). */
export async function getBillingOverviews(businessIds: string[]): Promise<Map<string, BillingOverview>> {
  const result = new Map<string, BillingOverview>();
  if (businessIds.length === 0) return result;

  const subs = await getSubscriptionsWithPlanForBusinesses(businessIds);
  const priceIds = [...subs.values()].map((s) => s.planPriceId).filter((id): id is string => !!id);
  const previousIds = [...subs.values()].map((s) => s.previousPlanId).filter((id): id is string => !!id);
  const crmBusinessIds = [...subs.values()].filter((s) => s.plan.products.includes("crm")).map((s) => s.businessId);

  const [prices, previousPlans, memberRows, inviteRows] = await Promise.all([
    priceIds.length ? prisma.planPrice.findMany({ where: { id: { in: priceIds } }, select: { id: true, amount: true } }) : [],
    previousIds.length ? prisma.plan.findMany({ where: { id: { in: previousIds } }, select: { id: true, name: true } }) : [],
    crmBusinessIds.length
      ? prisma.membership.groupBy({ by: ["businessId"], where: { businessId: { in: crmBusinessIds }, products: { has: "crm" } }, _count: { _all: true } })
      : [],
    crmBusinessIds.length
      ? prisma.invitation.groupBy({
          by: ["businessId"],
          where: { businessId: { in: crmBusinessIds }, products: { has: "crm" }, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          _count: { _all: true },
        })
      : [],
  ]);

  const priceById = new Map(prices.map((p) => [p.id, p.amount]));
  const planName = new Map(previousPlans.map((p) => [p.id, p.name]));
  const members = new Map(memberRows.map((r) => [r.businessId, r._count._all]));
  const invites = new Map(inviteRows.map((r) => [r.businessId, r._count._all]));

  for (const [businessId, sub] of subs) {
    result.set(
      businessId,
      buildBillingOverview(sub, {
        priceAmount: sub.planPriceId ? (priceById.get(sub.planPriceId) ?? null) : null,
        previousPlanName: sub.previousPlanId ? (planName.get(sub.previousPlanId) ?? null) : null,
        seatMembers: members.get(businessId) ?? 0,
        seatPending: invites.get(businessId) ?? 0,
      })
    );
  }
  return result;
}

export async function getBillingOverview(businessId: string): Promise<BillingOverview | null> {
  return (await getBillingOverviews([businessId])).get(businessId) ?? null;
}
