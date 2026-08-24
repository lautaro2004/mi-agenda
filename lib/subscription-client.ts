"use client";

import * as React from "react";

import { requestJson } from "@/lib/api-client";
import type { BillingSubscriptionStatus } from "@/lib/types";

// Tipos espejo de lo que devuelven app/api/business/subscription y
// app/api/plans — nunca se recalcula nada acá (ni límites ni % de uso): el
// backend (modules/billing/subscription.ts / lib/ai-limits.ts) es la única
// fuente de verdad, esto solo tipa la respuesta tal cual llega.

export interface SubscriptionPlanInfo {
  id: string;
  name: string;
  slug: string;
  monthlyPrice: number;
  currency: string;
  // Cantidad de respuestas de IA permitidas — no tokens (ver AiUsageEvent
  // para el consumo real en tokens, que se muestra aparte).
  aiCredits: number;
  // Diferenciación comercial más allá de aiCredits — ver
  // modules/billing/subscription.ts (resolvePlanFeatures). null en
  // maxServices = sin límite.
  maxServices: number | null;
  whatsappEnabled: boolean;
  depositsEnabled: boolean;
  customTrainingEnabled: boolean;
  statsEnabled: boolean;
  active: boolean;
}

export interface BusinessSubscriptionInfo {
  status: BillingSubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  plan: SubscriptionPlanInfo;
}

export interface AiUsageTotals {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface BusinessSubscriptionResponse {
  // null solo en el caso legacy de un negocio sin fila en Subscription
  // todavía (no debería pasar tras ensureTrialSubscription/backfill).
  subscription: BusinessSubscriptionInfo | null;
  access: { allowed: boolean };
  aiUsage: AiUsageTotals;
}

export function useBusinessSubscription() {
  const [data, setData] = React.useState<BusinessSubscriptionResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const reload = React.useCallback(() => {
    setLoading(true);
    setError(false);
    requestJson<BusinessSubscriptionResponse>("/api/business/subscription")
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(reload, [reload]);

  return { data, loading, error, reload };
}

export interface PublicPlan extends SubscriptionPlanInfo {
  description: string | null;
}

// Copy comercial compartido entre components/landing/pricing-cards.tsx
// (landing pública) y components/subscription-plan-card.tsx
// (/dashboard/suscripcion y /onboarding/suscripcion) — una sola fuente para
// que el subtítulo y los bullets de cada plan nunca queden desincronizados
// entre esas dos vistas. Mapeado por slug porque es puro copy, no una regla
// de negocio: un plan nuevo sin entrada acá simplemente no tiene subtítulo.
export const PLAN_SUBTITLE_BY_SLUG: Record<string, string> = {
  gratis: "Probalo",
  esencial: "Atendé",
  profesional: "Automatizá",
};

// Bullets generados a partir de datos REALES del Plan — nunca el mismo
// texto fijo para los 4 planes (ver resolvePlanFeatures en
// modules/billing/subscription.ts, mismo criterio que usan los gates).
export function buildPlanFeatureLines(plan: SubscriptionPlanInfo): string[] {
  const lines = ["Sitio web y reservas online"];
  lines.push(plan.whatsappEnabled ? "WhatsApp con IA" : "Asistente IA básico (sin WhatsApp)");
  if (plan.depositsEnabled) lines.push("Señas y comprobantes de pago");
  if (plan.customTrainingEnabled) lines.push("Entrenamiento personalizado del asistente");
  if (plan.statsEnabled) lines.push("Estadísticas de tu negocio");
  lines.push(plan.maxServices !== null ? `Hasta ${plan.maxServices} servicios` : "Servicios ilimitados");
  lines.push(`${new Intl.NumberFormat("es-AR").format(plan.aiCredits)} respuestas de IA / mes`);
  return lines;
}

export function useActivePlans() {
  const [plans, setPlans] = React.useState<PublicPlan[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    requestJson<{ plans: PublicPlan[] }>("/api/plans")
      .then(({ plans }) => setPlans(plans))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }, []);

  return { plans, loading };
}

// Días restantes de trial a partir de una fecha real (currentPeriodEnd) — no
// es un cálculo de negocio (no decide límites ni acceso, eso ya lo resolvió
// el backend en `access.allowed`), es aritmética de fechas para mostrar "te
// quedan X días" sin depender de otro round-trip cada vez que pasa un
// minuto en una pestaña abierta.
export function daysRemaining(periodEnd: string | null): number | null {
  if (!periodEnd) return null;
  const diffMs = new Date(periodEnd).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}
