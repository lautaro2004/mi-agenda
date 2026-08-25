import { prisma } from "@/lib/prisma";
import { assignSubscription, resolveCurrentPlanId } from "@/modules/billing/subscription";
import {
  computeBonusExpiresAt,
  evaluatePromoCode,
  normalizePromoCode,
  type PromoCodeRedemptionError,
} from "@/modules/promo-codes/validate";

export type { PromoCodeRedemptionError };

export interface RedeemPromoCodeResult {
  ok: true;
  planName: string;
  bonusExpiresAt: Date;
}

export type RedeemPromoCodeOutcome = RedeemPromoCodeResult | { ok: false; error: PromoCodeRedemptionError };

// Único punto de canje — ver auditoría (sección 8 del pedido): reutiliza
// assignSubscription() de modules/billing/subscription.ts tal cual, nunca
// una segunda lógica de suscripciones. Lo único nuevo acá es "¿este código
// puede usarse ahora mismo, y quién se queda con el uso si dos llegan a la
// vez?".
export async function redeemPromoCode(params: {
  code: string;
  businessId: string;
  userId: string;
}): Promise<RedeemPromoCodeOutcome> {
  const now = new Date();
  const code = normalizePromoCode(params.code);
  if (!code) return { ok: false, error: "not_found" };

  const promo = await prisma.promoCode.findUnique({ where: { code }, include: { plan: true } });

  const evaluation = evaluatePromoCode(promo, now);
  if (!evaluation.ok) return { ok: false, error: evaluation.reason };
  // evaluation.ok === true garantiza promo !== null acá (evaluatePromoCode
  // devuelve "not_found" en cualquier otro caso) — TypeScript no puede
  // inferir esa relación entre los dos valores, así que se afirma explícito.
  const found = promo!;

  if (!found.plan.active) return { ok: false, error: "plan_unavailable" };

  // Guard de concurrencia: UPDATE ... WHERE es atómico en Postgres, así que
  // si dos requests para el mismo código de 1 uso llegan a la vez, la
  // condición "usedCount < maxUses" solo puede ser verdadera para UNA de
  // las dos ejecuciones — la otra recibe count === 0 acá, sin necesidad de
  // SELECT FOR UPDATE ni una transacción serializable (mismo criterio que
  // el resto del proyecto: constraints/condiciones en la sentencia, no
  // locking manual — ver isUniqueConstraintError en
  // modules/appointments/service.ts para el mismo espíritu con otro caso).
  const increment = await prisma.promoCode.updateMany({
    where: {
      id: found.id,
      active: true,
      ...(found.maxUses !== null ? { usedCount: { lt: found.maxUses } } : {}),
    },
    data: { usedCount: { increment: 1 } },
  });
  if (increment.count === 0) {
    return { ok: false, error: "exhausted" };
  }

  const bonusExpiresAt = computeBonusExpiresAt(found.durationDays, now);
  // Mismo mecanismo de reversión automática que un beneficio otorgado a
  // mano desde Superadmin (ver grantTemporaryPlan/revertExpiredBenefits en
  // modules/billing/subscription.ts) — un código canjeado también debe
  // volver solo al plan anterior cuando se cumple bonusExpiresAt.
  const previousPlanId = await resolveCurrentPlanId(params.businessId);

  const assignResult = await assignSubscription(params.businessId, {
    planId: found.planId,
    status: "active",
    currentPeriodStart: now,
    currentPeriodEnd: bonusExpiresAt,
    provider: "promo_code",
    benefitExpiresAt: bonusExpiresAt,
    previousPlanId,
  });

  if (!assignResult.ok) {
    // Compensación: el uso ya se había reservado arriba, pero el canje no
    // se pudo completar (plan desactivado justo en el medio, caso raro) —
    // se libera para no dejar un uso "cobrado" sin beneficio real. Mismo
    // criterio de "nunca dejar datos a medias sin revertir" que
    // replaceMenuPdf/replaceSiteAsset en el resto del proyecto.
    await prisma.promoCode.update({ where: { id: found.id }, data: { usedCount: { decrement: 1 } } });
    return { ok: false, error: "plan_unavailable" };
  }

  await prisma.promoCodeRedemption.create({
    data: {
      promoCodeId: found.id,
      businessId: params.businessId,
      userId: params.userId,
      planNameSnapshot: found.plan.name,
      bonusExpiresAt,
    },
  });

  return { ok: true, planName: found.plan.name, bonusExpiresAt };
}

// ── Superadmin ────────────────────────────────────────────────────────────

export interface PromoCodeWithUsage {
  id: string;
  code: string;
  planId: string;
  planName: string;
  durationDays: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date;
  active: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toPromoCodeWithUsage(row: {
  id: string;
  code: string;
  planId: string;
  plan: { name: string };
  durationDays: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date;
  active: boolean;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}): PromoCodeWithUsage {
  return {
    id: row.id,
    code: row.code,
    planId: row.planId,
    planName: row.plan.name,
    durationDays: row.durationDays,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    expiresAt: row.expiresAt,
    active: row.active,
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listPromoCodes(): Promise<PromoCodeWithUsage[]> {
  const rows = await prisma.promoCode.findMany({
    include: { plan: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toPromoCodeWithUsage);
}

export interface PromoCodeRedemptionRow {
  id: string;
  businessId: string;
  businessName: string;
  userId: string;
  planNameSnapshot: string;
  bonusExpiresAt: Date;
  redeemedAt: Date;
}

export async function getPromoCodeDetail(
  id: string
): Promise<{ promoCode: PromoCodeWithUsage; redemptions: PromoCodeRedemptionRow[] } | null> {
  const row = await prisma.promoCode.findUnique({
    where: { id },
    include: { plan: { select: { name: true } } },
  });
  if (!row) return null;

  const redemptions = await prisma.promoCodeRedemption.findMany({
    where: { promoCodeId: id },
    include: { business: { select: { name: true } } },
    orderBy: { redeemedAt: "desc" },
  });

  return {
    promoCode: toPromoCodeWithUsage(row),
    redemptions: redemptions.map((r) => ({
      id: r.id,
      businessId: r.businessId,
      businessName: r.business.name,
      userId: r.userId,
      planNameSnapshot: r.planNameSnapshot,
      bonusExpiresAt: r.bonusExpiresAt,
      redeemedAt: r.redeemedAt,
    })),
  };
}

export interface PromoCodeInput {
  code: string;
  planId: string;
  durationDays: number;
  maxUses: number | null;
  expiresAt: Date;
  active?: boolean;
  description?: string | null;
}

export async function createPromoCode(data: PromoCodeInput): Promise<PromoCodeWithUsage> {
  const row = await prisma.promoCode.create({
    data: {
      code: normalizePromoCode(data.code),
      planId: data.planId,
      durationDays: data.durationDays,
      maxUses: data.maxUses,
      expiresAt: data.expiresAt,
      active: data.active ?? true,
      description: data.description || null,
    },
    include: { plan: { select: { name: true } } },
  });
  return toPromoCodeWithUsage(row);
}

export async function updatePromoCode(
  id: string,
  data: Partial<PromoCodeInput>
): Promise<PromoCodeWithUsage | null> {
  const existing = await prisma.promoCode.findUnique({ where: { id } });
  if (!existing) return null;

  const row = await prisma.promoCode.update({
    where: { id },
    data: {
      ...(data.code !== undefined ? { code: normalizePromoCode(data.code) } : {}),
      ...(data.planId !== undefined ? { planId: data.planId } : {}),
      ...(data.durationDays !== undefined ? { durationDays: data.durationDays } : {}),
      ...(data.maxUses !== undefined ? { maxUses: data.maxUses } : {}),
      ...(data.expiresAt !== undefined ? { expiresAt: data.expiresAt } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
    },
    include: { plan: { select: { name: true } } },
  });
  return toPromoCodeWithUsage(row);
}

