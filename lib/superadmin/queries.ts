import { prisma } from "@/lib/prisma";
import type { AiOperation } from "@/modules/ai/usage";
import type { TrainingMode } from "@/modules/ai/prompt/training";
import {
  getSubscriptionWithPlan,
  getSubscriptionsWithPlanForBusinesses,
  limitFromAccess,
  resolveAiAccess,
  type BusinessSubscription,
  type PlanSummary,
  type BillingSubscriptionStatus,
} from "@/modules/billing/subscription";

// Capa de lectura única para el dashboard de superadmin. Todo acá abajo es
// SOLO LECTURA sobre tablas que ya existen (Business, Membership, User,
// AiUsageEvent, TrainingPlan/Section, Appointment, Subscription, Plan) — no
// hay una segunda tabla de tracking, y ninguna de estas consultas escribe
// nada (salvo las funciones de administración de Plan/Subscription, que
// viven en modules/billing/subscription.ts, no acá).
//
// Ventana usada para "actividad reciente" al definir una empresa como
// "activa" — no existe ningún campo Business.status en el schema, así que
// esto es una definición derivada (y honesta) en vez de un dato guardado.
const ACTIVITY_WINDOW_DAYS = 30;

export type SuperadminPeriod = "7d" | "30d" | "month";

export function resolvePeriodStart(period: SuperadminPeriod): Date {
  const now = new Date();
  if (period === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (period === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export interface UsageTotals {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

function emptyTotals(): UsageTotals {
  return { requests: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

export async function getAiUsageSummary(params: {
  from: Date;
  to?: Date;
  businessId?: string;
  operation?: AiOperation;
}): Promise<UsageTotals> {
  const { from, to, businessId, operation } = params;
  const agg = await prisma.aiUsageEvent.aggregate({
    where: {
      createdAt: { gte: from, ...(to ? { lte: to } : {}) },
      ...(businessId ? { businessId } : {}),
      ...(operation ? { operation } : {}),
    },
    _count: { _all: true },
    _sum: { promptTokens: true, completionTokens: true },
  });

  const promptTokens = agg._sum.promptTokens ?? 0;
  const completionTokens = agg._sum.completionTokens ?? 0;
  return { requests: agg._count._all, promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
}

export interface UsageByOperationRow extends UsageTotals {
  operation: string;
}

export async function getAiUsageByOperation(params: {
  from: Date;
  to?: Date;
  businessId?: string;
}): Promise<UsageByOperationRow[]> {
  const { from, to, businessId } = params;
  const rows = await prisma.aiUsageEvent.groupBy({
    by: ["operation"],
    where: {
      createdAt: { gte: from, ...(to ? { lte: to } : {}) },
      ...(businessId ? { businessId } : {}),
    },
    _count: { _all: true },
    _sum: { promptTokens: true, completionTokens: true },
  });

  return rows
    .map((r) => {
      const promptTokens = r._sum.promptTokens ?? 0;
      const completionTokens = r._sum.completionTokens ?? 0;
      return {
        operation: r.operation,
        requests: r._count._all,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      };
    })
    .sort((a, b) => b.totalTokens - a.totalTokens);
}

export interface UsageTimeSeriesPoint {
  date: string; // YYYY-MM-DD
  requests: number;
  totalTokens: number;
}

// Se agrupa en JS (no con un date_trunc en SQL) a propósito: mantiene esto
// portable sin raw SQL para un volumen que hoy es chico. Si el volumen de
// AiUsageEvent crece mucho, este es el punto a reemplazar por una query
// agregada en la base.
export async function getAiUsageTimeSeries(params: {
  from: Date;
  businessId?: string;
  operation?: AiOperation;
}): Promise<UsageTimeSeriesPoint[]> {
  const { from, businessId, operation } = params;
  const rows = await prisma.aiUsageEvent.findMany({
    where: {
      createdAt: { gte: from },
      ...(businessId ? { businessId } : {}),
      ...(operation ? { operation } : {}),
    },
    select: { createdAt: true, promptTokens: true, completionTokens: true },
  });

  const byDay = new Map<string, { requests: number; totalTokens: number }>();
  for (const row of rows) {
    const key = row.createdAt.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { requests: 0, totalTokens: 0 };
    entry.requests += 1;
    entry.totalTokens += (row.promptTokens ?? 0) + (row.completionTokens ?? 0);
    byDay.set(key, entry);
  }

  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
}

export interface BusinessUsageRankingRow {
  businessId: string | null;
  businessName: string;
  totalTokens: number;
  requests: number;
  planName: string | null;
  aiCreditsLimit: number | null;
  // % del límite del plan consumido en el MISMO período que "requests"
  // (el `from` que recibió esta función) — no necesariamente el mes
  // calendario. null si el negocio no tiene un plan real asignado.
  aiUsagePercent: number | null;
}

export async function getAiUsageRanking(params: { from: Date; take?: number }): Promise<BusinessUsageRankingRow[]> {
  const { from, take = 10 } = params;
  const rows = await prisma.aiUsageEvent.groupBy({
    by: ["businessId"],
    where: { createdAt: { gte: from } },
    _count: { _all: true },
    _sum: { promptTokens: true, completionTokens: true },
  });

  const ids = rows.map((r) => r.businessId).filter((id): id is string => id !== null);
  const [businesses, subsByBusiness] = await Promise.all([
    ids.length ? prisma.business.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : Promise.resolve([]),
    getSubscriptionsWithPlanForBusinesses(ids),
  ]);
  const nameById = new Map(businesses.map((b) => [b.id, b.name]));

  return rows
    .map((r) => {
      const sub = r.businessId ? (subsByBusiness.get(r.businessId) ?? null) : null;
      const requests = r._count._all;
      const aiCreditsLimit = sub?.plan.aiCredits ?? null;
      return {
        businessId: r.businessId,
        businessName: r.businessId ? (nameById.get(r.businessId) ?? "Negocio eliminado") : "Sin negocio asociado",
        totalTokens: (r._sum.promptTokens ?? 0) + (r._sum.completionTokens ?? 0),
        requests,
        planName: sub?.plan.name ?? null,
        aiCreditsLimit,
        aiUsagePercent: aiCreditsLimit && aiCreditsLimit > 0 ? Math.round((requests / aiCreditsLimit) * 100) : null,
      };
    })
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, take);
}

export interface AiErrorRow {
  id: string;
  businessId: string | null;
  businessName: string | null;
  operation: string;
  model: string;
  errorMessage: string | null;
  createdAt: string;
}

export async function getRecentAiErrors(take = 15): Promise<AiErrorRow[]> {
  const rows = await prisma.aiUsageEvent.findMany({
    where: { success: false },
    orderBy: { createdAt: "desc" },
    take,
  });

  const ids = [...new Set(rows.map((r) => r.businessId).filter((id): id is string => id !== null))];
  const businesses = ids.length
    ? await prisma.business.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const nameById = new Map(businesses.map((b) => [b.id, b.name]));

  return rows.map((r) => ({
    id: r.id,
    businessId: r.businessId,
    businessName: r.businessId ? (nameById.get(r.businessId) ?? "Negocio eliminado") : null,
    operation: r.operation,
    model: r.model,
    errorMessage: r.errorMessage,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface AiLimitStatus {
  mode: TrainingMode;
  responses: number;
  limit: number;
  percent: number;
}

// Réplica exacta de qué conversación cuenta getOrCreateConversation() como
// "la vigente" por modo (la más reciente por updatedAt) — ver
// modules/employee/training/conversation.ts. Necesario para que el % que ve
// el superadmin coincida con el que efectivamente aplica el corte duro en
// runTrainingTurn(). El límite sale de modules/billing/subscription.ts
// (Subscription → Plan → aiCredits), UNA sola consulta acá (no una por modo).
export async function getAiLimitStatusForBusiness(businessId: string): Promise<AiLimitStatus[]> {
  const [conversations, sub] = await Promise.all([
    prisma.trainingConversation.findMany({
      where: { businessId },
      orderBy: { updatedAt: "desc" },
      select: { mode: true, _count: { select: { messages: { where: { role: "assistant" } } } } },
    }),
    getSubscriptionWithPlan(businessId),
  ]);
  const access = resolveAiAccess(sub);

  const seenModes = new Set<string>();
  const results: AiLimitStatus[] = [];
  for (const conv of conversations) {
    if (seenModes.has(conv.mode)) continue;
    seenModes.add(conv.mode);

    const mode = conv.mode as TrainingMode;
    const limit = limitFromAccess(access, businessId, mode);
    const responses = conv._count.messages;
    results.push({ mode, responses, limit, percent: limit > 0 ? Math.round((responses / limit) * 100) : 100 });
  }
  return results;
}

export interface BusinessLimitFlag {
  businessId: string;
  nearLimit: boolean;
  maxPercent: number;
}

const NEAR_LIMIT_PERCENT = 80;

// Versión en lote de getAiLimitStatusForBusiness(), pensada para listas
// (overview, tabla de empresas) sin hacer N+1 queries: UNA consulta de
// conversaciones + UNA de Subscription/Plan para todos los negocios pedidos,
// nunca una por negocio ni por conversación (limitFromAccess es pura, sin I/O).
export async function getAiLimitFlagsForBusinesses(businessIds: string[]): Promise<Map<string, BusinessLimitFlag>> {
  if (businessIds.length === 0) return new Map();

  const [conversations, subsByBusiness] = await Promise.all([
    prisma.trainingConversation.findMany({
      where: { businessId: { in: businessIds } },
      orderBy: { updatedAt: "desc" },
      select: { businessId: true, mode: true, _count: { select: { messages: { where: { role: "assistant" } } } } },
    }),
    getSubscriptionsWithPlanForBusinesses(businessIds),
  ]);

  const seen = new Set<string>();
  const maxPercentByBusiness = new Map<string, number>();

  for (const conv of conversations) {
    const key = `${conv.businessId}:${conv.mode}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const access = resolveAiAccess(subsByBusiness.get(conv.businessId) ?? null);
    const limit = limitFromAccess(access, conv.businessId, conv.mode as TrainingMode);
    const percent = limit > 0 ? Math.round((conv._count.messages / limit) * 100) : 100;
    maxPercentByBusiness.set(conv.businessId, Math.max(maxPercentByBusiness.get(conv.businessId) ?? 0, percent));
  }

  const result = new Map<string, BusinessLimitFlag>();
  for (const [businessId, maxPercent] of maxPercentByBusiness) {
    result.set(businessId, { businessId, nearLimit: maxPercent >= NEAR_LIMIT_PERCENT, maxPercent });
  }
  return result;
}

export interface OnboardingStatus {
  hasPlan: boolean;
  completed: number;
  ignored: number;
  pending: number;
  inProgress: number;
  isComplete: boolean;
}

const EMPTY_ONBOARDING_STATUS: OnboardingStatus = {
  hasPlan: false,
  completed: 0,
  ignored: 0,
  pending: 0,
  inProgress: 0,
  isComplete: false,
};

export async function getOnboardingStatusForBusinesses(businessIds: string[]): Promise<Map<string, OnboardingStatus>> {
  if (businessIds.length === 0) return new Map();

  const plans = await prisma.trainingPlan.findMany({
    where: { businessId: { in: businessIds } },
    include: { sections: true },
  });

  const result = new Map<string, OnboardingStatus>();
  for (const plan of plans) {
    const completed = plan.sections.filter((s) => s.status === "completed").length;
    const ignored = plan.sections.filter((s) => s.status === "ignored").length;
    const pending = plan.sections.filter((s) => s.status === "pending").length;
    const inProgress = plan.sections.filter((s) => s.status === "in_progress").length;
    result.set(plan.businessId, {
      hasPlan: true,
      completed,
      ignored,
      pending,
      inProgress,
      isComplete: plan.sections.length > 0 && pending === 0 && inProgress === 0,
    });
  }
  return result;
}

// "Activa" no es un campo guardado (Business no tiene status/isActive) — se
// deriva de actividad real en los últimos ACTIVITY_WINDOW_DAYS días, para no
// mostrar un número que no corresponde a ningún dato real.
export async function getActiveBusinessIds(): Promise<Set<string>> {
  const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [appointments, events] = await Promise.all([
    prisma.appointment.findMany({
      where: { createdAt: { gte: since } },
      select: { businessId: true },
      distinct: ["businessId"],
    }),
    prisma.aiUsageEvent.findMany({
      where: { createdAt: { gte: since }, businessId: { not: null } },
      select: { businessId: true },
      distinct: ["businessId"],
    }),
  ]);

  const ids = new Set<string>();
  for (const row of appointments) ids.add(row.businessId);
  for (const row of events) if (row.businessId) ids.add(row.businessId);
  return ids;
}

export async function getLastActivityForBusinesses(businessIds: string[]): Promise<Map<string, Date>> {
  if (businessIds.length === 0) return new Map();

  const [appointments, aiEvents] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["businessId"],
      where: { businessId: { in: businessIds } },
      _max: { createdAt: true },
    }),
    prisma.aiUsageEvent.groupBy({
      by: ["businessId"],
      where: { businessId: { in: businessIds } },
      _max: { createdAt: true },
    }),
  ]);

  const result = new Map<string, Date>();
  for (const row of appointments) {
    if (row._max.createdAt) result.set(row.businessId, row._max.createdAt);
  }
  for (const row of aiEvents) {
    if (!row.businessId || !row._max.createdAt) continue;
    const current = result.get(row.businessId);
    if (!current || row._max.createdAt > current) result.set(row.businessId, row._max.createdAt);
  }
  return result;
}

// ── Plan + Subscription por negocio ──────────────────────────────────────
// "IA del período" acá es SIEMPRE el mes calendario en curso (coherente con
// que Plan.monthlyPrice/aiCredits son magnitudes mensuales), independiente
// de cualquier selector de período que tenga la pantalla que lo consume —
// eso es un concepto distinto (ver getBusinessDetailForAdmin, donde
// "usage"/"usageByOperation" sí respetan el período elegido, pero
// planUsage no).

export interface PlanUsageInfo {
  plan: PlanSummary | null;
  subscriptionStatus: BillingSubscriptionStatus | "none";
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  // null = sin Subscription real (cae en el fallback legacy de
  // ai-limits.ts) — no hay un techo real contra el cual comparar.
  aiCreditsLimit: number | null;
  aiUsedThisPeriod: number;
  aiUsagePercent: number | null;
}

function buildPlanUsageInfo(sub: BusinessSubscription | null, requestsThisMonth: number): PlanUsageInfo {
  const access = resolveAiAccess(sub);
  const aiCreditsLimit = sub ? sub.plan.aiCredits : null;
  return {
    plan: sub?.plan ?? null,
    subscriptionStatus: access.status,
    currentPeriodStart: sub?.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    aiCreditsLimit,
    aiUsedThisPeriod: requestsThisMonth,
    aiUsagePercent: aiCreditsLimit && aiCreditsLimit > 0 ? Math.round((requestsThisMonth / aiCreditsLimit) * 100) : null,
  };
}

export interface SuperadminOverview {
  totalBusinesses: number;
  activeBusinesses: number;
  publicSites: number;
  trialBusinesses: number;
  activeSubscriptions: number;
  // Agrupado por moneda (normalmente un solo elemento, ARS) — suma del
  // monthlyPrice de los planes con Subscription "active". Es un ESTIMADO de
  // lista de precio, no dinero cobrado: no hay pagos reales todavía (ver
  // lib/payments/mercado-pago.ts, sigue siendo scaffolding).
  mrr: { currency: string; amount: number }[];
  aiUsageThisMonth: UsageTotals;
  onboardingIncompleteCount: number;
  nearAiLimitCount: number;
  recentAiErrors: AiErrorRow[];
}

export async function getSuperadminOverview(): Promise<SuperadminOverview> {
  const monthStart = resolvePeriodStart("month");

  const [totalBusinesses, publicSites, activeIds, aiUsageThisMonth, allBusinesses, recentAiErrors, subscriptionsByStatus, activeSubsWithPlan] =
    await Promise.all([
      prisma.business.count(),
      prisma.business.count({ where: { slug: { not: null } } }),
      getActiveBusinessIds(),
      getAiUsageSummary({ from: monthStart }),
      prisma.business.findMany({ select: { id: true } }),
      getRecentAiErrors(10),
      prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.subscription.findMany({ where: { status: "active" }, include: { plan: true } }),
    ]);

  const ids = allBusinesses.map((b) => b.id);
  const [onboardingMap, limitFlags] = await Promise.all([
    getOnboardingStatusForBusinesses(ids),
    getAiLimitFlagsForBusinesses(ids),
  ]);

  let onboardingIncompleteCount = 0;
  for (const id of ids) {
    if (!(onboardingMap.get(id) ?? EMPTY_ONBOARDING_STATUS).isComplete) onboardingIncompleteCount += 1;
  }

  let nearAiLimitCount = 0;
  for (const flag of limitFlags.values()) {
    if (flag.nearLimit) nearAiLimitCount += 1;
  }

  const trialBusinesses = subscriptionsByStatus.find((s) => s.status === "trialing")?._count._all ?? 0;
  const activeSubscriptions = subscriptionsByStatus.find((s) => s.status === "active")?._count._all ?? 0;

  const mrrByCurrency = new Map<string, number>();
  for (const sub of activeSubsWithPlan) {
    mrrByCurrency.set(sub.plan.currency, (mrrByCurrency.get(sub.plan.currency) ?? 0) + sub.plan.monthlyPrice);
  }

  return {
    totalBusinesses,
    activeBusinesses: activeIds.size,
    publicSites,
    trialBusinesses,
    activeSubscriptions,
    mrr: [...mrrByCurrency.entries()].map(([currency, amount]) => ({ currency, amount })),
    aiUsageThisMonth,
    onboardingIncompleteCount,
    nearAiLimitCount,
    recentAiErrors,
  };
}

export interface AdminBusinessListItem {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  createdAt: string;
  ownerEmail: string | null;
  status: "active" | "inactive";
  planUsage: PlanUsageInfo;
  aiUsageThisPeriod: UsageTotals;
  onboarding: OnboardingStatus;
  nearAiLimit: boolean;
  lastActivityAt: string | null;
}

export type AdminBusinessFilter = "all" | "onboarding_incomplete" | "near_limit" | "inactive";

export async function listBusinessesForAdmin(params: {
  q?: string;
  filter?: AdminBusinessFilter;
}): Promise<AdminBusinessListItem[]> {
  const { q, filter = "all" } = params;

  const businesses = await prisma.business.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 300,
    select: { id: true, name: true, slug: true, category: true, createdAt: true },
  });

  const ids = businesses.map((b) => b.id);
  const monthStart = resolvePeriodStart("month");

  const [memberships, usageRows, onboardingMap, limitFlags, activeIds, lastActivity, subsByBusiness] = await Promise.all([
    ids.length
      ? prisma.membership.findMany({
          where: { businessId: { in: ids }, role: "owner" },
          select: { businessId: true, user: { select: { email: true } } },
        })
      : Promise.resolve([]),
    ids.length
      ? prisma.aiUsageEvent.groupBy({
          by: ["businessId"],
          where: { businessId: { in: ids }, createdAt: { gte: monthStart } },
          _count: { _all: true },
          _sum: { promptTokens: true, completionTokens: true },
        })
      : Promise.resolve([]),
    getOnboardingStatusForBusinesses(ids),
    getAiLimitFlagsForBusinesses(ids),
    getActiveBusinessIds(),
    getLastActivityForBusinesses(ids),
    getSubscriptionsWithPlanForBusinesses(ids),
  ]);

  const ownerByBusiness = new Map<string, string>();
  for (const m of memberships) {
    if (!ownerByBusiness.has(m.businessId)) ownerByBusiness.set(m.businessId, m.user.email);
  }

  const usageByBusiness = new Map<string, UsageTotals>();
  for (const row of usageRows) {
    if (!row.businessId) continue;
    const promptTokens = row._sum.promptTokens ?? 0;
    const completionTokens = row._sum.completionTokens ?? 0;
    usageByBusiness.set(row.businessId, {
      requests: row._count._all,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    });
  }

  const items: AdminBusinessListItem[] = businesses.map((b) => {
    const limitFlag = limitFlags.get(b.id);
    const usage = usageByBusiness.get(b.id) ?? emptyTotals();
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      category: b.category,
      createdAt: b.createdAt.toISOString(),
      ownerEmail: ownerByBusiness.get(b.id) ?? null,
      status: activeIds.has(b.id) ? "active" : "inactive",
      planUsage: buildPlanUsageInfo(subsByBusiness.get(b.id) ?? null, usage.requests),
      aiUsageThisPeriod: usage,
      onboarding: onboardingMap.get(b.id) ?? EMPTY_ONBOARDING_STATUS,
      nearAiLimit: limitFlag?.nearLimit ?? false,
      lastActivityAt: lastActivity.get(b.id)?.toISOString() ?? null,
    };
  });

  if (filter === "onboarding_incomplete") return items.filter((i) => !i.onboarding.isComplete);
  if (filter === "near_limit") return items.filter((i) => i.nearAiLimit);
  if (filter === "inactive") return items.filter((i) => i.status === "inactive");
  return items;
}

export interface AdminBusinessDetail {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  slug: string | null;
  createdAt: string;
  ownerEmail: string | null;
  status: "active" | "inactive";
  planUsage: PlanUsageInfo;
  onboarding: OnboardingStatus;
  aiLimitStatus: AiLimitStatus[];
  usage: UsageTotals;
  usageByOperation: UsageByOperationRow[];
  recentAiEvents: {
    id: string;
    operation: string;
    model: string;
    promptTokens: number | null;
    completionTokens: number | null;
    success: boolean;
    createdAt: string;
  }[];
  recentAppointments: {
    id: string;
    serviceName: string;
    customerName: string;
    date: string;
    startTime: string;
    createdAt: string;
  }[];
}

export async function getBusinessDetailForAdmin(
  businessId: string,
  period: SuperadminPeriod
): Promise<AdminBusinessDetail | null> {
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) return null;

  const from = resolvePeriodStart(period);
  const monthStart = resolvePeriodStart("month");

  const [
    membership,
    onboardingMap,
    aiLimitStatus,
    usage,
    usageByOperation,
    activeIds,
    recentAiEventsRaw,
    recentAppointments,
    sub,
    monthlyUsage,
  ] = await Promise.all([
    prisma.membership.findFirst({ where: { businessId, role: "owner" }, select: { user: { select: { email: true } } } }),
    getOnboardingStatusForBusinesses([businessId]),
    getAiLimitStatusForBusiness(businessId),
    getAiUsageSummary({ from, businessId }),
    getAiUsageByOperation({ from, businessId }),
    getActiveBusinessIds(),
    prisma.aiUsageEvent.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.appointment.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: 10 }),
    getSubscriptionWithPlan(businessId),
    getAiUsageSummary({ from: monthStart, businessId }),
  ]);

  return {
    id: business.id,
    name: business.name,
    description: business.description,
    category: business.category,
    phone: business.phone,
    whatsappNumber: business.whatsappNumber,
    slug: business.slug,
    createdAt: business.createdAt.toISOString(),
    ownerEmail: membership?.user.email ?? null,
    status: activeIds.has(businessId) ? "active" : "inactive",
    planUsage: buildPlanUsageInfo(sub, monthlyUsage.requests),
    onboarding: onboardingMap.get(businessId) ?? EMPTY_ONBOARDING_STATUS,
    aiLimitStatus,
    usage,
    usageByOperation,
    recentAiEvents: recentAiEventsRaw.map((e) => ({
      id: e.id,
      operation: e.operation,
      model: e.model,
      promptTokens: e.promptTokens,
      completionTokens: e.completionTokens,
      success: e.success,
      createdAt: e.createdAt.toISOString(),
    })),
    recentAppointments: recentAppointments.map((a) => ({
      id: a.id,
      serviceName: a.serviceName,
      customerName: a.customerName,
      date: a.date,
      startTime: a.startTime,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
