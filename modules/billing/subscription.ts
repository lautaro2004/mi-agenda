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

// "manual" es la asignación directa desde Superadmin. "mercadopago" es un
// cobro recurrente real (ver modules/billing/mercadopago/, Fase 3+).
// "promo_code"/"benefit" son bonificaciones temporales (ver
// benefitExpiresAt/previousPlanId más abajo).
export const SUBSCRIPTION_PROVIDERS = ["manual", "mercadopago", "promo_code", "benefit"] as const;

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
  maxServices: number | null;
  whatsappEnabled: boolean;
  depositsEnabled: boolean;
  customTrainingEnabled: boolean;
  statsEnabled: boolean;
  galleryEnabled: boolean;
  digitalMenuEnabled: boolean;
  active: boolean;
  // Ver modules/billing/mercadopago/sync-plan.ts — null = Gratis (nunca
  // sincroniza) o un plan pago que todavía no se sincronizó ni una vez.
  mercadoPagoPlanId: string | null;
  mercadoPagoSyncStatus: string | null;
  mercadoPagoLastSyncedAt: Date | null;
  mercadoPagoSyncError: string | null;
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
  // Estado crudo de Mercado Pago (pending|authorized|paused|cancelled) —
  // nunca se usa para decidir gating, solo para mostrar/depurar. Ver
  // comentario en el modelo Subscription.
  mercadoPagoStatus: string | null;
  mercadoPagoLastSyncedAt: Date | null;
  // no null = bonificación temporal en curso — ver comentario en el modelo
  // Subscription (prisma/schema.prisma) y revertExpiredBenefits() más abajo.
  benefitExpiresAt: Date | null;
  previousPlanId: string | null;
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
    mercadoPagoStatus: row.mercadoPagoStatus,
    mercadoPagoLastSyncedAt: row.mercadoPagoLastSyncedAt,
    benefitExpiresAt: row.benefitExpiresAt,
    previousPlanId: row.previousPlanId,
    plan: planToSummary(row.plan),
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

// ── Features por plan (más allá de aiCredits) ────────────────────────────
// Separado a propósito de resolveAiAccess(): esto depende SOLO de qué
// incluye el Plan, no del estado de la Subscription — un negocio con la
// suscripción en past_due sigue viendo su configuración de WhatsApp/señas
// (no se le apaga de golpe, solo se corta la IA, ver PlanBlock en
// /dashboard/suscripcion). "Sin Subscription todavía" (dato legacy) deja
// todo habilitado, mismo criterio que el fallback de resolveAiAccess: no
// bloquear negocios preexistentes por una migración que no les asignó plan.
export interface PlanFeatures {
  maxServices: number | null;
  whatsappEnabled: boolean;
  depositsEnabled: boolean;
  customTrainingEnabled: boolean;
  statsEnabled: boolean;
  galleryEnabled: boolean;
  digitalMenuEnabled: boolean;
}

const UNGATED_FEATURES: PlanFeatures = {
  maxServices: null,
  whatsappEnabled: true,
  depositsEnabled: true,
  customTrainingEnabled: true,
  statsEnabled: true,
  galleryEnabled: true,
  digitalMenuEnabled: true,
};

export function resolvePlanFeatures(sub: BusinessSubscription | null): PlanFeatures {
  if (!sub) return UNGATED_FEATURES;
  return {
    maxServices: sub.plan.maxServices,
    whatsappEnabled: sub.plan.whatsappEnabled,
    depositsEnabled: sub.plan.depositsEnabled,
    customTrainingEnabled: sub.plan.customTrainingEnabled,
    statsEnabled: sub.plan.statsEnabled,
    galleryEnabled: sub.plan.galleryEnabled,
    digitalMenuEnabled: sub.plan.digitalMenuEnabled,
  };
}

// Punto único que usan las rutas de API que gatean por feature — un solo
// query (igual que resolveAiResponseLimit), nunca reimplementado inline en
// cada route handler.
export async function resolveBusinessPlanFeatures(businessId: string): Promise<PlanFeatures> {
  const sub = await getSubscriptionWithPlan(businessId);
  return resolvePlanFeatures(sub);
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

// Único lector de un Plan por id fuera de Superadmin (create/updatePlan) —
// usado por modules/billing/mercadopago/checkout.ts (Fase 3) para validar
// active/mercadoPagoPlanId antes de contratar, sin que ese módulo toque
// prisma directamente (mismo criterio de dependencia en un solo sentido que
// sync-plan.ts).
export async function getPlanById(planId: string): Promise<PlanSummary | null> {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  return plan ? planToSummary(plan) : null;
}

// Usado por modules/billing/mercadopago/cancel.ts (Fase 5): al cancelar una
// suscripción paga, el negocio vuelve a Gratis de inmediato — mismo plan por
// defecto que ensureTrialSubscription()/revertExpiredBenefits() resuelven
// por slug, expuesto acá como PlanSummary completo (no solo el id) para que
// cancel.ts no tenga que hacer una segunda query.
export async function getDefaultPlan(): Promise<PlanSummary | null> {
  const plan = await prisma.plan.findUnique({ where: { slug: DEFAULT_PLAN_SLUG } });
  return plan ? planToSummary(plan) : null;
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
    ...planToSummary(p),
    description: p.description,
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
  // null/ausente = sin límite. Ver comentario en schema.prisma.
  maxServices?: number | null;
  whatsappEnabled?: boolean;
  depositsEnabled?: boolean;
  customTrainingEnabled?: boolean;
  statsEnabled?: boolean;
  galleryEnabled?: boolean;
  digitalMenuEnabled?: boolean;
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
      maxServices: data.maxServices ?? null,
      whatsappEnabled: data.whatsappEnabled ?? true,
      depositsEnabled: data.depositsEnabled ?? true,
      customTrainingEnabled: data.customTrainingEnabled ?? true,
      statsEnabled: data.statsEnabled ?? true,
      galleryEnabled: data.galleryEnabled ?? true,
      digitalMenuEnabled: data.digitalMenuEnabled ?? true,
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
      ...(data.maxServices !== undefined ? { maxServices: data.maxServices } : {}),
      ...(data.whatsappEnabled !== undefined ? { whatsappEnabled: data.whatsappEnabled } : {}),
      ...(data.depositsEnabled !== undefined ? { depositsEnabled: data.depositsEnabled } : {}),
      ...(data.customTrainingEnabled !== undefined ? { customTrainingEnabled: data.customTrainingEnabled } : {}),
      ...(data.statsEnabled !== undefined ? { statsEnabled: data.statsEnabled } : {}),
      ...(data.galleryEnabled !== undefined ? { galleryEnabled: data.galleryEnabled } : {}),
      ...(data.digitalMenuEnabled !== undefined ? { digitalMenuEnabled: data.digitalMenuEnabled } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });

  const count = await prisma.subscription.count({ where: { planId: id } });
  return { ...planToSummary(plan), description: plan.description, createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt.toISOString(), businessCount: count };
}

// ── Sincronización con Mercado Pago (ver modules/billing/mercadopago/) ──
// Único punto que escribe los 4 campos mercadoPago* de Plan — separado a
// propósito de createPlan()/updatePlan(): esos dos son el CRUD del "Plan de
// Nexo" tal como lo edita Superadmin a mano (nunca aceptan estos campos como
// input), esto es lo que llama la orquestación de sync después de hablar con
// la API de Mercado Pago. mercadoPagoLastSyncedAt se pisa siempre con "ahora"
// — cada llamada acá ES un intento de sincronización, exitoso o no.
export interface PlanMercadoPagoSyncUpdate {
  // Ausente = no se creó/reemplazó ningún preapproval_plan en este intento
  // (ej. una sincronización que solo actualiza metadata). Presente = pisa el
  // id vigente, típicamente porque se creó una versión nueva por cambio de
  // precio.
  mercadoPagoPlanId?: string;
  mercadoPagoSyncStatus: "synced" | "error";
  mercadoPagoSyncError: string | null;
}

export async function updatePlanMercadoPagoSync(
  planId: string,
  data: PlanMercadoPagoSyncUpdate
): Promise<PlanWithUsage | null> {
  const existing = await prisma.plan.findUnique({ where: { id: planId } });
  if (!existing) return null;

  const plan = await prisma.plan.update({
    where: { id: planId },
    data: {
      ...(data.mercadoPagoPlanId !== undefined ? { mercadoPagoPlanId: data.mercadoPagoPlanId } : {}),
      mercadoPagoSyncStatus: data.mercadoPagoSyncStatus,
      mercadoPagoSyncError: data.mercadoPagoSyncError,
      mercadoPagoLastSyncedAt: new Date(),
    },
  });

  const count = await prisma.subscription.count({ where: { planId } });
  return { ...planToSummary(plan), description: plan.description, createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt.toISOString(), businessCount: count };
}

function planToSummary(plan: {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number;
  currency: string;
  aiCredits: number;
  maxServices: number | null;
  whatsappEnabled: boolean;
  depositsEnabled: boolean;
  customTrainingEnabled: boolean;
  statsEnabled: boolean;
  galleryEnabled: boolean;
  digitalMenuEnabled: boolean;
  active: boolean;
  mercadoPagoPlanId: string | null;
  mercadoPagoSyncStatus: string | null;
  mercadoPagoLastSyncedAt: Date | null;
  mercadoPagoSyncError: string | null;
}): PlanSummary {
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    monthlyPrice: plan.monthlyPrice,
    currency: plan.currency,
    aiCredits: plan.aiCredits,
    maxServices: plan.maxServices,
    whatsappEnabled: plan.whatsappEnabled,
    depositsEnabled: plan.depositsEnabled,
    customTrainingEnabled: plan.customTrainingEnabled,
    statsEnabled: plan.statsEnabled,
    galleryEnabled: plan.galleryEnabled,
    digitalMenuEnabled: plan.digitalMenuEnabled,
    active: plan.active,
    mercadoPagoPlanId: plan.mercadoPagoPlanId,
    mercadoPagoSyncStatus: plan.mercadoPagoSyncStatus,
    mercadoPagoLastSyncedAt: plan.mercadoPagoLastSyncedAt,
    mercadoPagoSyncError: plan.mercadoPagoSyncError,
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
  // Ausentes/undefined = sin bonificación en curso (el caso normal: la
  // asignación manual de siempre desde /superadmin/empresas/[id] cancela
  // cualquier reversión automática pendiente, a propósito — un admin
  // tocando el plan a mano ahora es dueño de esa asignación). Ver
  // grantTemporaryPlan() y modules/promo-codes/service.ts para quienes SÍ
  // los pasan.
  benefitExpiresAt?: Date | null;
  previousPlanId?: string | null;
  // Ausentes/undefined = sin vínculo con Mercado Pago (el caso normal:
  // asignación manual/beneficio/promo, ninguno de los tres pasa esto — ver
  // Fase 9). Igual criterio que benefitExpiresAt/previousPlanId arriba: una
  // asignación que no los pasa explícitamente los limpia — quien SÍ tiene un
  // preapproval vigente (checkout.ts, el webhook) los vuelve a pasar en cada
  // llamada, nunca asume que quedaron de una vez anterior.
  providerSubscriptionId?: string | null;
  mercadoPagoStatus?: string | null;
  mercadoPagoLastSyncedAt?: Date | null;
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
      benefitExpiresAt: input.benefitExpiresAt ?? null,
      previousPlanId: input.previousPlanId ?? null,
      providerSubscriptionId: input.providerSubscriptionId ?? null,
      mercadoPagoStatus: input.mercadoPagoStatus ?? null,
      mercadoPagoLastSyncedAt: input.mercadoPagoLastSyncedAt ?? null,
    },
    update: {
      planId: input.planId,
      status: input.status,
      currentPeriodStart: input.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd,
      provider: input.provider ?? "manual",
      benefitExpiresAt: input.benefitExpiresAt ?? null,
      previousPlanId: input.previousPlanId ?? null,
      providerSubscriptionId: input.providerSubscriptionId ?? null,
      mercadoPagoStatus: input.mercadoPagoStatus ?? null,
      mercadoPagoLastSyncedAt: input.mercadoPagoLastSyncedAt ?? null,
    },
    include: { plan: true },
  });

  return { ok: true, subscription: toBusinessSubscription(row) };
}

// Snapshot de "a qué plan volver" al otorgar una bonificación — el plan
// ACTUAL del negocio en este momento, o el plan por defecto (Gratis) si
// todavía no tiene Subscription (no debería pasar, ver ensureTrialSubscription,
// pero cubre el caso defensivamente en vez de fallar).
export async function resolveCurrentPlanId(businessId: string): Promise<string | null> {
  const sub = await prisma.subscription.findUnique({ where: { businessId }, select: { planId: true } });
  if (sub) return sub.planId;
  const defaultPlan = await prisma.plan.findUnique({ where: { slug: DEFAULT_PLAN_SLUG }, select: { id: true } });
  return defaultPlan?.id ?? null;
}

// Único punto que otorga una bonificación temporal desde Superadmin (sección
// 1 del pedido: "para cada empresa... otorgarle temporalmente un plan
// superior"). Reutiliza assignSubscription() tal cual — nunca una segunda
// lógica de suscripciones — solo agrega el snapshot de a qué plan volver.
export async function grantTemporaryPlan(params: {
  businessId: string;
  planId: string;
  expiresAt: Date;
}): Promise<{ ok: true; subscription: BusinessSubscription } | { ok: false; error: AssignSubscriptionError }> {
  const previousPlanId = await resolveCurrentPlanId(params.businessId);
  const now = new Date();

  return assignSubscription(params.businessId, {
    planId: params.planId,
    status: "active",
    currentPeriodStart: now,
    currentPeriodEnd: params.expiresAt,
    provider: "benefit",
    benefitExpiresAt: params.expiresAt,
    previousPlanId,
  });
}

// Corrida periódica (ver app/api/cron/revert-expired-benefits) — nunca se
// dispara al leer una Subscription (resolveAiAccess sigue siendo una función
// pura, sin I/O de escritura): mismo criterio que el resto de los cron jobs
// del proyecto (cleanupOrphanPaymentProofs, etc.), un barrido periódico en
// vez de mutar datos como efecto secundario de una lectura.
export async function revertExpiredBenefits(now: Date = new Date()): Promise<{ reverted: number; skipped: number }> {
  const expired = await prisma.subscription.findMany({ where: { benefitExpiresAt: { lte: now } } });
  const defaultPlan = await prisma.plan.findUnique({ where: { slug: DEFAULT_PLAN_SLUG }, select: { id: true } });

  let reverted = 0;
  let skipped = 0;

  for (const sub of expired) {
    const previousPlan = sub.previousPlanId ? await prisma.plan.findUnique({ where: { id: sub.previousPlanId } }) : null;
    // Si el plan al que había que volver ya no existe o fue desactivado
    // después de otorgar la bonificación, cae al plan Gratis por defecto —
    // nunca deja un negocio sin ningún plan asignable.
    const targetPlanId = previousPlan?.active ? previousPlan.id : defaultPlan?.id;

    if (!targetPlanId) {
      skipped++;
      continue;
    }

    const result = await assignSubscription(sub.businessId, {
      planId: targetPlanId,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: null,
      provider: "manual",
      benefitExpiresAt: null,
      previousPlanId: null,
    });

    if (result.ok) reverted++;
    else skipped++;
  }

  return { reverted, skipped };
}
