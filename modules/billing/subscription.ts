import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { TrainingMode } from "@/modules/ai/prompt/training";
import { BILLING_SUBSCRIPTION_STATUSES, type BillingSubscriptionStatus } from "@/lib/types";

// ── Planes y suscripciones ───────────────────────────────────────────────
// Única capa que entiende Subscription/Plan: lib/ai-limits.ts (hot path, un
// negocio a la vez) y lib/superadmin/queries.ts (listas, batch) pasan
// siempre por acá — ninguno de los dos reimplementa "¿está vencido el
// trial?" ni "¿cuál es el límite efectivo?" por su cuenta. Ver también
// ensureTrialSubscription(), usada por modules/business/membership.ts al
// crear un negocio nuevo.
//
// BILLING_SUBSCRIPTION_STATUSES/BillingSubscriptionStatus viven en lib/types.ts (no acá) a
// propósito: este archivo importa Prisma (server-only, node:net/tls/dns vía
// pg) y lib/schemas.ts / componentes cliente necesitan esos literales sin
// arrastrar eso al bundle del browser. Re-exportados acá solo por
// comodidad de import para el resto de los módulos server-side.
export { BILLING_SUBSCRIPTION_STATUSES, type BillingSubscriptionStatus };

// "manual" es todo lo que existe hoy (asignado desde Superadmin). Se deja
// listo el valor "mercadopago" para cuando exista esa integración — no se
// implementa checkout/webhooks en esta etapa.
export const SUBSCRIPTION_PROVIDERS = ["manual", "mercadopago"] as const;

// Plan que se asigna a negocios nuevos (ver ensureTrialSubscription) y al
// que se backfillean los negocios que existían antes de este sistema (ver
// la migración prisma/migrations/*_add_plans_and_subscriptions). Si cambia,
// hay que actualizar el slug también en esa migración — no se leen uno del
// otro porque SQL no puede importar esta constante.
export const DEFAULT_PLAN_SLUG = "gratis";
const DEFAULT_TRIAL_DAYS = 14;

export interface PlanSummary {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number;
  currency: string;
  aiCredits: number;
  active: boolean;
}

export interface BusinessSubscription {
  id: string;
  businessId: string;
  planId: string;
  status: BillingSubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  provider: string | null;
  providerSubscriptionId: string | null;
  plan: PlanSummary;
}

type SubscriptionWithPlan = Prisma.SubscriptionGetPayload<{ include: { plan: true } }>;

function toBusinessSubscription(row: SubscriptionWithPlan): BusinessSubscription {
  return {
    id: row.id,
    businessId: row.businessId,
    planId: row.planId,
    status: row.status as BillingSubscriptionStatus,
    currentPeriodStart: row.currentPeriodStart,
    currentPeriodEnd: row.currentPeriodEnd,
    provider: row.provider,
    providerSubscriptionId: row.providerSubscriptionId,
    plan: {
      id: row.plan.id,
      name: row.plan.name,
      slug: row.plan.slug,
      monthlyPrice: row.plan.monthlyPrice,
      currency: row.plan.currency,
      aiCredits: row.plan.aiCredits,
      active: row.plan.active,
    },
  };
}

export async function getSubscriptionWithPlan(businessId: string): Promise<BusinessSubscription | null> {
  const row = await prisma.subscription.findUnique({ where: { businessId }, include: { plan: true } });
  return row ? toBusinessSubscription(row) : null;
}

export async function getSubscriptionsWithPlanForBusinesses(
  businessIds: string[]
): Promise<Map<string, BusinessSubscription>> {
  if (businessIds.length === 0) return new Map();

  const rows = await prisma.subscription.findMany({
    where: { businessId: { in: businessIds } },
    include: { plan: true },
  });

  const map = new Map<string, BusinessSubscription>();
  for (const row of rows) map.set(row.businessId, toBusinessSubscription(row));
  return map;
}

// Fallback transicional: SOLO se usa si un negocio no tiene fila en
// Subscription todavía (no debería pasar tras la migración de backfill —
// ver prisma/migrations/*_add_plans_and_subscriptions — pero cubre datos
// legacy o una carrera entre crear el Business y crear su Subscription).
// Mismos valores/env vars que existían antes de que hubiera Plan
// persistido. El console.warn es intencional: si esto sigue disparándose en
// producción después de la migración, es la señal de que algo no
// backfilleó bien.
const LEGACY_DEFAULT_ONBOARDING = 40;
const LEGACY_DEFAULT_CONTINUOUS = 200;

function legacyFallbackLimit(businessId: string, mode: TrainingMode): number {
  console.warn(
    `[billing] Negocio ${businessId} sin Subscription — usando el límite legacy por env/default para modo "${mode}". Esto no debería pasar después del backfill inicial.`
  );
  const envValue = mode === "onboarding" ? process.env.ONBOARDING_MAX_AI_RESPONSES : process.env.CONTINUOUS_MAX_AI_RESPONSES;
  const fallback = mode === "onboarding" ? LEGACY_DEFAULT_ONBOARDING : LEGACY_DEFAULT_CONTINUOUS;
  const parsed = envValue ? Number(envValue) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export interface AiAccessResolution {
  // true si el negocio puede seguir generando respuestas de IA en general
  // (independiente del conteo puntual de esta conversación).
  allowed: boolean;
  // Límite de respuestas de IA aplicable, en la misma unidad que usaba
  // ai-limits.ts antes de este cambio (cantidad de respuestas, no tokens).
  // -1 es un valor interno ("no hay Subscription, usar el fallback legacy")
  // — nunca se expone fuera de este módulo, ver limitFromAccess().
  limit: number;
  status: BillingSubscriptionStatus | "none";
}

// Única función que entiende la semántica de estados. trialing vencido,
// canceled y expired cortan el acceso (limit 0) — exactamente lo que pide
// la sección 11 del pedido: "si el trial está vencido, no debería seguir
// consumiendo IA ilimitadamente". past_due se trata como período de gracia
// (sigue activo): no hay dunning ni reintentos de cobro implementados
// todavía, así que cortar de inmediato sería más agresivo de lo que el
// sistema puede justificar hoy.
//
// Desactivar un Plan (Plan.active = false) NO corta retroactivamente a
// quienes ya lo tienen asignado — eso sería un efecto secundario sorpresivo
// de una acción de administración no relacionada. Plan.active solo impide
// asignar ESE plan a nuevas suscripciones (ver assignSubscription).
export function resolveAiAccess(sub: BusinessSubscription | null): AiAccessResolution {
  if (!sub) return { allowed: true, limit: -1, status: "none" };

  switch (sub.status) {
    case "trialing": {
      const expired = sub.currentPeriodEnd !== null && sub.currentPeriodEnd.getTime() < Date.now();
      return expired
        ? { allowed: false, limit: 0, status: sub.status }
        : { allowed: true, limit: sub.plan.aiCredits, status: sub.status };
    }
    case "active":
    case "past_due":
      return { allowed: true, limit: sub.plan.aiCredits, status: sub.status };
    case "canceled":
    case "expired":
    default:
      return { allowed: false, limit: 0, status: sub.status };
  }
}

// Traduce el -1 interno de resolveAiAccess a un número real. Función pura
// (sin I/O): segura de llamar en un loop batch sin generar N+1 queries.
export function limitFromAccess(access: AiAccessResolution, businessId: string, mode: TrainingMode): number {
  return access.limit === -1 ? legacyFallbackLimit(businessId, mode) : access.limit;
}

// Punto único que usa lib/ai-limits.ts — mantiene el contrato existente
// (siempre un entero positivo usable como tope duro en runTrainingTurn),
// ahora resuelto desde Subscription → Plan en vez de una env var fija. Un
// solo query (Subscription + Plan vía include) por llamada.
export async function resolveAiResponseLimit(businessId: string, mode: TrainingMode): Promise<number> {
  const sub = await getSubscriptionWithPlan(businessId);
  return limitFromAccess(resolveAiAccess(sub), businessId, mode);
}

// Versión batch — usada por lib/superadmin/queries.ts para listas/overview.
// Una sola query para todos los negocios pedidos (no una por negocio), y
// limitFromAccess() es pura, así que el resto del cálculo no toca la base.
export async function resolveAiResponseLimitsForBusinesses(
  businessIds: string[],
  mode: TrainingMode
): Promise<Map<string, number>> {
  const subs = await getSubscriptionsWithPlanForBusinesses(businessIds);
  const result = new Map<string, number>();
  for (const id of businessIds) {
    result.set(id, limitFromAccess(resolveAiAccess(subs.get(id) ?? null), id, mode));
  }
  return result;
}

// Se llama al crear un Business nuevo (ver modules/business/membership.ts).
// Nunca lanza: si el plan por defecto no existe todavía (ej. la migración de
// seed no corrió), el negocio queda sin Subscription y cae en el fallback
// legacy de arriba — no bloquea el registro por esto.
export async function ensureTrialSubscription(businessId: string): Promise<void> {
  const existing = await prisma.subscription.findUnique({ where: { businessId }, select: { id: true } });
  if (existing) return;

  const plan = await prisma.plan.findUnique({ where: { slug: DEFAULT_PLAN_SLUG } });
  if (!plan) {
    console.error(
      `[billing] No se encontró el plan por defecto "${DEFAULT_PLAN_SLUG}" — el negocio ${businessId} queda sin Subscription (usará el fallback legacy de ai-limits hasta que se le asigne un plan manualmente desde Superadmin).`
    );
    return;
  }

  const now = new Date();
  const currentPeriodEnd = new Date(now.getTime() + DEFAULT_TRIAL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.subscription.create({
    data: {
      businessId,
      planId: plan.id,
      status: "trialing",
      currentPeriodStart: now,
      currentPeriodEnd,
      provider: "manual",
    },
  });
}

// ── Planes públicos (negocio autenticado) ────────────────────────────────
// A diferencia de listPlansForAdmin(): solo planes activos, sin
// businessCount ni ningún campo administrativo — esto es lo que puede ver
// CUALQUIER negocio logueado (ver app/api/plans/route.ts), nunca un plan
// desactivado ni cuántas empresas lo tienen.

export interface PublicPlan extends PlanSummary {
  description: string | null;
}

export async function listActivePlans(): Promise<PublicPlan[]> {
  const plans = await prisma.plan.findMany({ where: { active: true }, orderBy: { monthlyPrice: "asc" } });
  return plans.map((p) => ({ ...planToSummary(p), description: p.description }));
}

// ── Administración de Planes (Superadmin) ────────────────────────────────

export interface PlanWithUsage extends PlanSummary {
  description: string | null;
  createdAt: string;
  updatedAt: string;
  businessCount: number;
}

export async function listPlansForAdmin(): Promise<PlanWithUsage[]> {
  const [plans, counts] = await Promise.all([
    prisma.plan.findMany({ orderBy: { monthlyPrice: "asc" } }),
    prisma.subscription.groupBy({ by: ["planId"], _count: { _all: true } }),
  ]);

  const countByPlan = new Map(counts.map((c) => [c.planId, c._count._all]));

  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    monthlyPrice: p.monthlyPrice,
    currency: p.currency,
    aiCredits: p.aiCredits,
    active: p.active,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    businessCount: countByPlan.get(p.id) ?? 0,
  }));
}

export interface PlanInput {
  name: string;
  slug: string;
  description?: string | null;
  monthlyPrice: number;
  currency: string;
  aiCredits: number;
  active?: boolean;
}

export async function createPlan(data: PlanInput): Promise<PlanWithUsage> {
  const plan = await prisma.plan.create({
    data: {
      name: data.name,
      slug: data.slug,
      description: data.description || null,
      monthlyPrice: data.monthlyPrice,
      currency: data.currency,
      aiCredits: data.aiCredits,
      active: data.active ?? true,
    },
  });
  return { ...planToSummary(plan), description: plan.description, createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt.toISOString(), businessCount: 0 };
}

export async function updatePlan(id: string, data: Partial<PlanInput>): Promise<PlanWithUsage | null> {
  const existing = await prisma.plan.findUnique({ where: { id } });
  if (!existing) return null;

  const plan = await prisma.plan.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.slug !== undefined ? { slug: data.slug } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.monthlyPrice !== undefined ? { monthlyPrice: data.monthlyPrice } : {}),
      ...(data.currency !== undefined ? { currency: data.currency } : {}),
      ...(data.aiCredits !== undefined ? { aiCredits: data.aiCredits } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });

  const count = await prisma.subscription.count({ where: { planId: id } });
  return { ...planToSummary(plan), description: plan.description, createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt.toISOString(), businessCount: count };
}

function planToSummary(plan: { id: string; name: string; slug: string; monthlyPrice: number; currency: string; aiCredits: number; active: boolean }): PlanSummary {
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    monthlyPrice: plan.monthlyPrice,
    currency: plan.currency,
    aiCredits: plan.aiCredits,
    active: plan.active,
  };
}

// ── Asignación manual de plan (Superadmin) ───────────────────────────────
// Todo lo que existe hoy para "activar" un negocio: no hay checkout, esto
// es el único punto de entrada que crea/actualiza una Subscription. Al ser
// businessId único en Subscription, esto es siempre un upsert — nunca puede
// crear una segunda suscripción "compitiendo" con la existente.

export interface AssignSubscriptionInput {
  planId: string;
  status: BillingSubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  provider?: string;
}

export type AssignSubscriptionError = "plan_not_found" | "plan_inactive";

export async function assignSubscription(
  businessId: string,
  input: AssignSubscriptionInput
): Promise<{ ok: true; subscription: BusinessSubscription } | { ok: false; error: AssignSubscriptionError }> {
  const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
  if (!plan) return { ok: false, error: "plan_not_found" };
  if (!plan.active) return { ok: false, error: "plan_inactive" };

  const row = await prisma.subscription.upsert({
    where: { businessId },
    create: {
      businessId,
      planId: input.planId,
      status: input.status,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      provider: input.provider ?? "manual",
    },
    update: {
      planId: input.planId,
      status: input.status,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      provider: input.provider ?? "manual",
    },
    include: { plan: true },
  });

  return { ok: true, subscription: toBusinessSubscription(row) };
}
