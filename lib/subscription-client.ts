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
