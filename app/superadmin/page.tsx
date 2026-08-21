"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Bot, Building2, CircleDollarSign, CreditCard, Globe, Percent, ShieldAlert, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { MetricCard } from "@/components/superadmin/metric-card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";

interface AiErrorRow {
  id: string;
  businessId: string | null;
  businessName: string | null;
  operation: string;
  model: string;
  errorMessage: string | null;
  createdAt: string;
}

interface SuperadminOverview {
  totalBusinesses: number;
  activeBusinesses: number;
  publicSites: number;
  trialBusinesses: number;
  activeSubscriptions: number;
  mrr: { currency: string; amount: number }[];
  aiUsageThisMonth: { requests: number; promptTokens: number; completionTokens: number; totalTokens: number };
  onboardingIncompleteCount: number;
  nearAiLimitCount: number;
  recentAiErrors: AiErrorRow[];
}

function formatMrr(mrr: { currency: string; amount: number }[]): string {
  if (mrr.length === 0) return "$0";
  return mrr
    .map(({ currency, amount }) => {
      try {
        return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
      } catch {
        return `${currency} ${new Intl.NumberFormat("es-AR").format(amount)}`;
      }
    })
    .join(" + ");
}

const numberFormatter = new Intl.NumberFormat("es-AR");
const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function SuperadminOverviewPage() {
  const [overview, setOverview] = React.useState<SuperadminOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    requestJson<{ overview: SuperadminOverview }>("/api/superadmin/overview")
      .then(({ overview }) => setOverview(overview))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Resumen" description="Estado general de la plataforma." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="space-y-8">
        <PageHeader title="Resumen" description="Estado general de la plataforma." />
        <p className="text-sm text-destructive">No pudimos cargar el resumen. Recargá la página.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Resumen" description="Estado general de la plataforma." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={Building2}
          label="Empresas totales"
          value={numberFormatter.format(overview.totalBusinesses)}
        />
        <MetricCard
          icon={Sparkles}
          label="Empresas activas"
          value={numberFormatter.format(overview.activeBusinesses)}
          description="Con actividad de IA o turnos en los últimos 30 días"
        />
        <MetricCard
          icon={CreditCard}
          label="Suscripciones activas"
          value={numberFormatter.format(overview.activeSubscriptions)}
        />
        <MetricCard
          icon={Percent}
          label="En prueba"
          value={numberFormatter.format(overview.trialBusinesses)}
        />
        <MetricCard
          icon={CircleDollarSign}
          label="MRR estimado"
          value={formatMrr(overview.mrr)}
          description="Precio de lista de las suscripciones activas — no hay pagos reales todavía."
        />
        <MetricCard
          icon={Bot}
          label="Consumo de IA (mes actual)"
          value={`${numberFormatter.format(overview.aiUsageThisMonth.totalTokens)} tokens`}
          description={`${numberFormatter.format(overview.aiUsageThisMonth.requests)} requests`}
        />
        <MetricCard
          icon={Globe}
          label="Sitios públicos"
          value={numberFormatter.format(overview.publicSites)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Estados que requieren atención</h3>
          <ul className="mt-4 space-y-3">
            <li className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <ShieldAlert className="size-4" />
                Onboarding incompleto
              </span>
              <Link href="/superadmin/empresas?filter=onboarding_incomplete" className="font-medium text-foreground hover:underline">
                {overview.onboardingIncompleteCount}
              </Link>
            </li>
            <li className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="size-4" />
                Cerca del límite de IA
              </span>
              <Link href="/superadmin/empresas?filter=near_limit" className="font-medium text-foreground hover:underline">
                {overview.nearAiLimitCount}
              </Link>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Errores recientes de IA</h3>
          {overview.recentAiErrors.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Sin errores registrados.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {overview.recentAiErrors.slice(0, 6).map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium text-foreground">{e.businessName ?? "Sin negocio"}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.operation} · {e.errorMessage?.slice(0, 60) ?? "sin detalle"}
                    </p>
                  </div>
                  <Badge variant="destructive" className="shrink-0">
                    {dateTimeFormatter.format(new Date(e.createdAt))}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
