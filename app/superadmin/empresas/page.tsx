"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { GrantBenefitDialog } from "@/components/superadmin/grant-benefit-dialog";
import { requestJson } from "@/lib/api-client";

interface PlanUsageInfo {
  plan: { id: string; name: string; slug: string; monthlyPrice: number; currency: string; aiCredits: number; active: boolean } | null;
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled" | "expired" | "none";
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  aiCreditsLimit: number | null;
  aiUsedThisPeriod: number;
  aiUsagePercent: number | null;
  benefitExpiresAt: string | null;
}

interface AdminBusinessListItem {
  id: string;
  name: string;
  slug: string | null;
  category: string | null;
  createdAt: string;
  ownerEmail: string | null;
  status: "active" | "inactive";
  planUsage: PlanUsageInfo;
  aiUsageThisPeriod: { requests: number; promptTokens: number; completionTokens: number; totalTokens: number };
  onboarding: { hasPlan: boolean; isComplete: boolean };
  nearAiLimit: boolean;
  lastActivityAt: string | null;
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
  if (status === "past_due") return "outline";
  if (status === "canceled" || status === "expired") return "destructive";
  return "outline";
}

type Filter = "all" | "onboarding_incomplete" | "near_limit" | "inactive";

const FILTER_LABEL: Record<Filter, string> = {
  all: "Todas",
  onboarding_incomplete: "Onboarding incompleto",
  near_limit: "Cerca del límite de IA",
  inactive: "Inactivas",
};

const numberFormatter = new Intl.NumberFormat("es-AR");
const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });

const VALID_FILTERS: Filter[] = ["all", "onboarding_incomplete", "near_limit", "inactive"];

export default function SuperadminEmpresasPage() {
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [planSlug, setPlanSlug] = React.useState<string | null>(null);
  const [businesses, setBusinesses] = React.useState<AdminBusinessListItem[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Se lee de window.location en vez de useSearchParams() para no forzar un
  // boundary de Suspense en esta página — mismo criterio que
  // app/onboarding/horarios/page.tsx. Permite linkear acá con
  // ?filter=... desde el Resumen (ver app/superadmin/page.tsx) o
  // ?plan=slug desde la columna "Empresas" de /superadmin/planes.
  React.useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const fromUrl = search.get("filter") as Filter | null;
    if (fromUrl && VALID_FILTERS.includes(fromUrl)) setFilter(fromUrl);
    const plan = search.get("plan");
    if (plan) setPlanSlug(plan);
  }, []);

  const currentParams = React.useCallback(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (filter !== "all") params.set("filter", filter);
    if (planSlug) params.set("plan", planSlug);
    return params;
  }, [q, filter, planSlug]);

  // Recarga inmediata (sin debounce) — usada después de otorgar un
  // beneficio, para que la tabla refleje el plan/badge nuevo sin esperar el
  // debounce de búsqueda.
  const reload = React.useCallback(() => {
    setLoading(true);
    requestJson<{ businesses: AdminBusinessListItem[] }>(`/api/superadmin/empresas?${currentParams().toString()}`)
      .then(({ businesses }) => setBusinesses(businesses))
      .catch(() => setBusinesses([]))
      .finally(() => setLoading(false));
  }, [currentParams]);

  React.useEffect(() => {
    const timeout = setTimeout(reload, 250); // debounce simple para la búsqueda por texto
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter, planSlug]);

  return (
    <div className="space-y-6">
      <PageHeader title="Empresas" description="Todos los negocios registrados en la plataforma." />

      {planSlug && (
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="secondary">Plan: {planSlug}</Badge>
          <button type="button" onClick={() => setPlanSlug(null)} className="text-muted-foreground hover:text-foreground hover:underline">
            Quitar filtro
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre..."
            className="pl-9"
          />
        </div>

        <Select value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FILTER_LABEL) as Filter[]).map((key) => (
              <SelectItem key={key} value={key}>
                {FILTER_LABEL[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Empresa</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Creada</th>
              <th className="px-4 py-3 font-medium">Uso de IA (mes)</th>
              <th className="px-4 py-3 font-medium">Última actividad</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={7}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : !businesses || businesses.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={7}>
                  No hay empresas que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              businesses.map((b) => (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/superadmin/empresas/${b.id}`} className="font-medium text-foreground hover:underline">
                      {b.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">{b.ownerEmail ?? "sin dueño"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{b.planUsage.plan?.name ?? "Sin plan"}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant={subscriptionBadgeVariant(b.planUsage.subscriptionStatus)}>
                        {SUBSCRIPTION_STATUS_LABEL[b.planUsage.subscriptionStatus]}
                      </Badge>
                      {b.planUsage.benefitExpiresAt && (
                        <Badge variant="outline" className="gap-1 text-[11px]">
                          <Sparkles className="size-3" />
                          Hasta {dateFormatter.format(new Date(b.planUsage.benefitExpiresAt))}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={b.status === "active" ? "secondary" : "outline"}>
                        {b.status === "active" ? "Activa" : "Inactiva"}
                      </Badge>
                      {!b.onboarding.isComplete && <Badge variant="outline">Onboarding incompleto</Badge>}
                      {b.nearAiLimit && <Badge variant="destructive">Cerca del límite</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{dateFormatter.format(new Date(b.createdAt))}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {b.planUsage.aiCreditsLimit !== null ? (
                      <>
                        {numberFormatter.format(b.planUsage.aiUsedThisPeriod)} / {numberFormatter.format(b.planUsage.aiCreditsLimit)}
                        <span className="text-xs"> · {b.planUsage.aiUsagePercent}%</span>
                      </>
                    ) : (
                      <>
                        {numberFormatter.format(b.aiUsageThisPeriod.totalTokens)} tokens
                        <span className="text-xs"> · {numberFormatter.format(b.aiUsageThisPeriod.requests)} req</span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {b.lastActivityAt ? dateFormatter.format(new Date(b.lastActivityAt)) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <GrantBenefitDialog
                      businessId={b.id}
                      businessName={b.name}
                      trigger={
                        <Button size="sm" variant="outline">
                          <Sparkles className="size-3.5" data-icon="inline-start" />
                          Otorgar plan
                        </Button>
                      }
                      onGranted={() => {
                        toast.success(`Plan otorgado a ${b.name}`);
                        reload();
                      }}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
