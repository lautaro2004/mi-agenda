"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";

interface PlanUsageInfo {
  plan: { id: string; name: string; slug: string; monthlyPrice: number; currency: string; aiCredits: number; active: boolean } | null;
  subscriptionStatus: "trialing" | "active" | "past_due" | "canceled" | "expired" | "none";
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  aiCreditsLimit: number | null;
  aiUsedThisPeriod: number;
  aiUsagePercent: number | null;
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
  const [businesses, setBusinesses] = React.useState<AdminBusinessListItem[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Se lee de window.location en vez de useSearchParams() para no forzar un
  // boundary de Suspense en esta página — mismo criterio que
  // app/onboarding/horarios/page.tsx. Permite linkear acá con
  // ?filter=... desde el Resumen (ver app/superadmin/page.tsx).
  React.useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("filter") as Filter | null;
    if (fromUrl && VALID_FILTERS.includes(fromUrl)) setFilter(fromUrl);
  }, []);

  React.useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (filter !== "all") params.set("filter", filter);

    const timeout = setTimeout(() => {
      requestJson<{ businesses: AdminBusinessListItem[] }>(`/api/superadmin/empresas?${params.toString()}`)
        .then(({ businesses }) => setBusinesses(businesses))
        .catch(() => setBusinesses([]))
        .finally(() => setLoading(false));
    }, 250); // debounce simple para la búsqueda por texto

    return () => clearTimeout(timeout);
  }, [q, filter]);

  return (
    <div className="space-y-6">
      <PageHeader title="Empresas" description="Todos los negocios registrados en la plataforma." />

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
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : !businesses || businesses.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
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
                    <Badge variant={subscriptionBadgeVariant(b.planUsage.subscriptionStatus)} className="mt-1">
                      {SUBSCRIPTION_STATUS_LABEL[b.planUsage.subscriptionStatus]}
                    </Badge>
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
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
