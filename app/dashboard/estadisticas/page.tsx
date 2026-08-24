"use client";

import * as React from "react";
import Link from "next/link";
import { BarChart3, Bot, CalendarCheck2, CreditCard, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requestJson } from "@/lib/api-client";
import { useBusinessSubscription } from "@/lib/subscription-client";

interface BusinessStats {
  appointments: { total: number; confirmed: number; cancelled: number; awaitingPayment: number };
  proofs: { received: number; approved: number; rejected: number; pending: number };
  aiUsage: { requests: number; totalTokens: number };
  byService: { serviceName: string; count: number }[];
}

type Period = "7d" | "30d" | "month";
const PERIOD_LABEL: Record<Period, string> = { "7d": "7 días", "30d": "30 días", month: "Mes actual" };

const numberFormatter = new Intl.NumberFormat("es-AR");

export default function EstadisticasPage() {
  const { data: subscriptionData, loading: subscriptionLoading } = useBusinessSubscription();
  const [period, setPeriod] = React.useState<Period>("month");
  const [stats, setStats] = React.useState<BusinessStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const statsEnabled = subscriptionData?.subscription?.plan.statsEnabled ?? true;
  // El desglose por servicio es el diferencial de Profesional (ver sección A
  // de la propuesta) — comparar por slug alcanza para esto, no amerita una
  // columna de Plan aparte (no es un gate duro, es aditivo).
  const advanced = subscriptionData?.subscription?.plan.slug === "profesional";

  React.useEffect(() => {
    if (!statsEnabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    requestJson<{ stats: BusinessStats }>(`/api/business/stats?period=${period}`)
      .then(({ stats }) => setStats(stats))
      .catch((err) => setError(err instanceof Error ? err.message : "No pudimos cargar las estadísticas."))
      .finally(() => setLoading(false));
  }, [period, statsEnabled]);

  if (subscriptionLoading) {
    return (
      <div>
        <PageHeader title="Estadísticas" description="Un resumen de tu actividad reciente." />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!statsEnabled) {
    return (
      <div>
        <PageHeader title="Estadísticas" description="Un resumen de tu actividad reciente." />
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Lock className="size-6" />
          </div>
          <p className="text-sm font-medium text-foreground">Las estadísticas están disponibles desde el plan Esencial</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Vas a poder ver turnos, señas y uso de IA de tu negocio en un solo lugar.
          </p>
          <Button className="mt-2" render={<Link href="/dashboard/suscripcion" />} nativeButton={false}>
            Ver planes
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <PageHeader title="Estadísticas" description="Un resumen de tu actividad reciente." />
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
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] rounded-2xl" />
          ))}
        </div>
      ) : error || !stats ? (
        <p className="text-sm text-destructive">{error ?? "No pudimos cargar las estadísticas."}</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={CalendarCheck2} label="Turnos" value={numberFormatter.format(stats.appointments.total)} description={`${stats.appointments.confirmed} confirmados`} href="/dashboard/turnos" />
            <StatCard icon={CreditCard} label="Comprobantes recibidos" value={numberFormatter.format(stats.proofs.received)} description={`${stats.proofs.approved} aprobados · ${stats.proofs.rejected} rechazados`} href="/dashboard/turnos" />
            <StatCard icon={Bot} label="Respuestas de IA" value={numberFormatter.format(stats.aiUsage.requests)} description="Este período" href="/dashboard/suscripcion" />
            <StatCard icon={BarChart3} label="Turnos cancelados" value={numberFormatter.format(stats.appointments.cancelled)} description={`${stats.appointments.awaitingPayment} esperando seña`} href="/dashboard/turnos" />
          </div>

          {advanced && stats.byService.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground">Turnos por servicio</h3>
              <ul className="mt-4 space-y-2.5">
                {stats.byService.map((row) => {
                  const max = Math.max(...stats.byService.map((r) => r.count), 1);
                  return (
                    <li key={row.serviceName} className="text-sm">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="text-foreground">{row.serviceName}</span>
                        <span>{row.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.max((row.count / max) * 100, 3)}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
