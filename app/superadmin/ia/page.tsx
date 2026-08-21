"use client";

import * as React from "react";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/page-header";
import { MetricCard } from "@/components/superadmin/metric-card";
import { UsageBarChart } from "@/components/superadmin/usage-chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";
import { Activity, ArrowDownToLine, ArrowUpFromLine, Bot } from "lucide-react";

interface UsageTotals {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface UsageByOperationRow extends UsageTotals {
  operation: string;
}

interface TimeSeriesPoint {
  date: string;
  requests: number;
  totalTokens: number;
}

interface RankingRow {
  businessId: string | null;
  businessName: string;
  totalTokens: number;
  requests: number;
  planName: string | null;
  aiCreditsLimit: number | null;
  aiUsagePercent: number | null;
}

interface IaResponse {
  summary: UsageTotals;
  byOperation: UsageByOperationRow[];
  timeSeries: TimeSeriesPoint[];
  ranking: RankingRow[];
  operations: string[];
}

interface BusinessOption {
  id: string;
  name: string;
}

type Period = "7d" | "30d" | "month";

const PERIOD_LABEL: Record<Period, string> = { "7d": "7 días", "30d": "30 días", month: "Mes actual" };
const numberFormatter = new Intl.NumberFormat("es-AR");
const shortDateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" });

export default function SuperadminIaPage() {
  const [period, setPeriod] = React.useState<Period>("30d");
  const [businessId, setBusinessId] = React.useState<string>("all");
  const [operation, setOperation] = React.useState<string>("all");
  const [businesses, setBusinesses] = React.useState<BusinessOption[]>([]);
  const [data, setData] = React.useState<IaResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    requestJson<{ businesses: BusinessOption[] }>("/api/superadmin/empresas")
      .then(({ businesses }) => setBusinesses(businesses))
      .catch(() => setBusinesses([]));
  }, []);

  React.useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (businessId !== "all") params.set("businessId", businessId);
    if (operation !== "all") params.set("operation", operation);

    requestJson<IaResponse>(`/api/superadmin/ia?${params.toString()}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [period, businessId, operation]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Uso de IA"
        description="Fuente de verdad: AiUsageEvent — cada llamada real a Gemini queda registrada acá."
      />

      <div className="flex flex-wrap gap-3">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-40" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <SelectItem key={p} value={p}>
                {PERIOD_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={businessId} onValueChange={(v) => setBusinessId(v ?? "all")}>
          <SelectTrigger className="w-56" size="sm">
            <SelectValue placeholder="Todas las empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las empresas</SelectItem>
            {businesses.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={operation} onValueChange={(v) => setOperation(v ?? "all")}>
          <SelectTrigger className="w-56" size="sm">
            <SelectValue placeholder="Todas las operaciones" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las operaciones</SelectItem>
            {(data?.operations ?? []).map((op) => (
              <SelectItem key={op} value={op}>
                {op}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Activity} label="Requests" value={numberFormatter.format(data.summary.requests)} />
            <MetricCard icon={ArrowDownToLine} label="Input tokens" value={numberFormatter.format(data.summary.promptTokens)} />
            <MetricCard icon={ArrowUpFromLine} label="Output tokens" value={numberFormatter.format(data.summary.completionTokens)} />
            <MetricCard icon={Bot} label="Total tokens" value={numberFormatter.format(data.summary.totalTokens)} />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">Evolución de tokens</h3>
            <div className="mt-4">
              <UsageBarChart
                points={data.timeSeries.map((p) => ({
                  label: shortDateFormatter.format(new Date(`${p.date}T00:00:00`)),
                  value: p.totalTokens,
                }))}
                valueFormatter={(v) => `${numberFormatter.format(v)} tokens`}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground">Ranking de empresas</h3>
              {data.ranking.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Sin consumo en este período.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {data.ranking.map((row, i) => (
                    <li key={row.businessId ?? `sin-negocio-${i}`} className="flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        {row.businessId ? (
                          <Link href={`/superadmin/empresas/${row.businessId}`} className="truncate font-medium text-foreground hover:underline">
                            {i + 1}. {row.businessName}
                          </Link>
                        ) : (
                          <span className="truncate text-muted-foreground">
                            {i + 1}. {row.businessName}
                          </span>
                        )}
                        <p className="text-xs text-muted-foreground">{row.planName ?? "Sin plan"}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {row.aiCreditsLimit !== null ? (
                          <>
                            <p className="text-foreground">
                              {numberFormatter.format(row.requests)} / {numberFormatter.format(row.aiCreditsLimit)}
                            </p>
                            <p className={(row.aiUsagePercent ?? 0) >= 80 ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
                              {row.aiUsagePercent}%
                            </p>
                          </>
                        ) : (
                          <p className="text-muted-foreground">{numberFormatter.format(row.totalTokens)} tokens</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground">Consumo por operación</h3>
              {data.byOperation.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">Sin datos en este período.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.byOperation.map((row) => {
                    const max = Math.max(...data.byOperation.map((r) => r.totalTokens), 1);
                    return (
                      <li key={row.operation} className="text-sm">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{row.operation}</span>
                          <span>
                            {numberFormatter.format(row.totalTokens)} tokens · {row.requests} req
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary/70"
                            style={{ width: `${Math.max((row.totalTokens / max) * 100, 3)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
