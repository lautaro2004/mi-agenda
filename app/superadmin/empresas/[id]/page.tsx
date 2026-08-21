"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { AssignPlanDialog } from "@/components/superadmin/assign-plan-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";

interface AiLimitStatus {
  mode: "onboarding" | "continuous";
  responses: number;
  limit: number;
  percent: number;
}

interface UsageTotals {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface UsageByOperationRow extends UsageTotals {
  operation: string;
}

interface PlanUsageInfo {
  plan: { id: string; name: string; slug: string; monthlyPrice: number; currency: string; aiCredits: number; active: boolean } | null;
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled" | "expired" | "none";
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  aiCreditsLimit: number | null;
  aiUsedThisPeriod: number;
  aiUsagePercent: number | null;
}

const SUBSCRIPTION_STATUS_LABEL: Record<PlanUsageInfo["subscriptionStatus"], string> = {
  trialing: "Prueba",
  active: "Activa",
  past_due: "Pago vencido",
  canceled: "Cancelada",
  expired: "Expirada",
  none: "Sin suscripción",
};

function subscriptionBadgeVariant(status: PlanUsageInfo["subscriptionStatus"]): "secondary" | "outline" | "destructive" {
  if (status === "active" || status === "trialing") return "secondary";
  if (status === "canceled" || status === "expired") return "destructive";
  return "outline";
}

interface AdminBusinessDetail {
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
  onboarding: { hasPlan: boolean; completed: number; ignored: number; pending: number; inProgress: number; isComplete: boolean };
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
  recentAppointments: { id: string; serviceName: string; customerName: string; date: string; startTime: string; createdAt: string }[];
}

type Period = "7d" | "30d" | "month";

const PERIOD_LABEL: Record<Period, string> = { "7d": "7 días", "30d": "30 días", month: "Mes actual" };
const MODE_LABEL: Record<string, string> = { onboarding: "Onboarding", continuous: "Continuo" };

const numberFormatter = new Intl.NumberFormat("es-AR");
const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function SuperadminEmpresaDetailPage() {
  const params = useParams<{ id: string }>();
  const businessId = decodeURIComponent(params.id ?? "");

  const [period, setPeriod] = React.useState<Period>("month");
  const [business, setBusiness] = React.useState<AdminBusinessDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  const loadBusiness = React.useCallback(() => {
    if (!businessId) return;
    setLoading(true);
    requestJson<{ business: AdminBusinessDetail }>(`/api/superadmin/empresas/${businessId}?period=${period}`)
      .then(({ business }) => setBusiness(business))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [businessId, period]);

  React.useEffect(loadBusiness, [loadBusiness]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[100px] rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !business) {
    return (
      <div className="space-y-4">
        <Link href="/superadmin/empresas" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Volver a empresas
        </Link>
        <p className="text-sm text-destructive">No encontramos esta empresa.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/superadmin/empresas" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Volver a empresas
        </Link>
        <div className="mt-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{business.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {business.category ?? "Sin rubro"} · {business.ownerEmail ?? "sin dueño"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={business.status === "active" ? "secondary" : "outline"}>
              {business.status === "active" ? "Activa" : "Inactiva"}
            </Badge>
            {!business.onboarding.isComplete && <Badge variant="outline">Onboarding incompleto</Badge>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <InfoTile label="Creada" value={new Date(business.createdAt).toLocaleDateString("es-AR")} />
        <InfoTile label="Sitio público" value={business.slug ? `/s/${business.slug}` : "No generado"} />
        <InfoTile label="WhatsApp" value={business.whatsappNumber ?? "—"} />
        <InfoTile label="Dueño" value={business.ownerEmail ?? "—"} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Plan y suscripción</h3>
            <p className="mt-1 text-lg font-medium text-foreground">{business.planUsage.plan?.name ?? "Sin plan"}</p>
          </div>
          <AssignPlanDialog
            businessId={business.id}
            current={{
              planId: business.planUsage.plan?.id ?? null,
              status: business.planUsage.subscriptionStatus,
              currentPeriodStart: business.planUsage.currentPeriodStart,
              currentPeriodEnd: business.planUsage.currentPeriodEnd,
            }}
            onAssigned={loadBusiness}
            trigger={
              <Button size="sm" variant="outline">
                <Pencil className="size-3.5" data-icon="inline-start" />
                Asignar plan
              </Button>
            }
          />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Suscripción</p>
            <Badge variant={subscriptionBadgeVariant(business.planUsage.subscriptionStatus)} className="mt-1">
              {SUBSCRIPTION_STATUS_LABEL[business.planUsage.subscriptionStatus]}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Período</p>
            <p className="mt-1 font-medium text-foreground">
              {business.planUsage.currentPeriodStart ? new Date(business.planUsage.currentPeriodStart).toLocaleDateString("es-AR") : "—"}
              {" → "}
              {business.planUsage.currentPeriodEnd ? new Date(business.planUsage.currentPeriodEnd).toLocaleDateString("es-AR") : "sin fecha de fin"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">IA (este mes)</p>
            {business.planUsage.aiCreditsLimit !== null ? (
              <>
                <p className="mt-1 font-medium text-foreground">
                  {numberFormatter.format(business.planUsage.aiUsedThisPeriod)} / {numberFormatter.format(business.planUsage.aiCreditsLimit)}
                </p>
                <Progress value={Math.min(business.planUsage.aiUsagePercent ?? 0, 100)} className="mt-2" />
                <p className="mt-1 text-xs text-muted-foreground">{business.planUsage.aiUsagePercent}%</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Sin plan asignado — usando límite por defecto.</p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Plan de entrenamiento</h3>
        {!business.onboarding.hasPlan ? (
          <p className="mt-2 text-sm text-muted-foreground">Todavía no se generó un plan para este negocio.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span className="text-emerald-600 dark:text-emerald-400">{business.onboarding.completed} completadas</span>
            <span className="text-muted-foreground">{business.onboarding.ignored} omitidas</span>
            <span className="text-muted-foreground">{business.onboarding.pending} pendientes</span>
            <span className="text-amber-600 dark:text-amber-400">{business.onboarding.inProgress} en progreso</span>
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Uso de IA</h3>
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <InfoTile label="Requests" value={numberFormatter.format(business.usage.requests)} />
          <InfoTile label="Input tokens" value={numberFormatter.format(business.usage.promptTokens)} />
          <InfoTile label="Output tokens" value={numberFormatter.format(business.usage.completionTokens)} />
          <InfoTile label="Total tokens" value={numberFormatter.format(business.usage.totalTokens)} />
        </div>

        {business.aiLimitStatus.length > 0 && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {business.aiLimitStatus.map((s) => (
              <div
                key={s.mode}
                className={
                  s.percent >= 80
                    ? "rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
                    : "rounded-2xl border border-border bg-card p-5"
                }
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">{MODE_LABEL[s.mode] ?? s.mode}</span>
                  <span className={s.percent >= 80 ? "font-medium text-destructive" : "text-muted-foreground"}>
                    {s.responses} / {s.limit} respuestas ({s.percent}%)
                  </span>
                </div>
                <Progress value={Math.min(s.percent, 100)} className="mt-3" />
              </div>
            ))}
          </div>
        )}

        {business.usageByOperation.length > 0 && (
          <div className="mt-4 rounded-2xl border border-border bg-card p-5">
            <h4 className="text-sm font-semibold text-foreground">Distribución por operación</h4>
            <ul className="mt-3 space-y-2">
              {business.usageByOperation.map((row) => {
                const max = Math.max(...business.usageByOperation.map((r) => r.totalTokens), 1);
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
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Actividad de IA reciente</h3>
          {business.recentAiEvents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Sin eventos registrados.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {business.recentAiEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    {e.operation}
                    {!e.success && (
                      <Badge variant="destructive" className="ml-2">
                        error
                      </Badge>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">{dateTimeFormatter.format(new Date(e.createdAt))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground">Turnos recientes</h3>
          {business.recentAppointments.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Sin turnos registrados.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {business.recentAppointments.map((a) => (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">
                    {a.serviceName} · {a.customerName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {a.date} {a.startTime}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}
