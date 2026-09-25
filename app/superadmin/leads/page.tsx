"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarCheck2, Search, UserCheck, UserPlus, Users } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { MetricCard } from "@/components/superadmin/metric-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";
import { BUSINESS_CATEGORIES } from "@/lib/types";
import { LEAD_GOAL_LABEL, LEAD_STATUSES, LEAD_STATUS_META, type LeadGoal, type LeadStatus } from "@/lib/types";

interface LeadListItem {
  id: string;
  name: string;
  businessName: string;
  whatsapp: string;
  email: string;
  industry: string;
  goals: LeadGoal[];
  suggestedPlan: string | null;
  status: LeadStatus;
  createdAt: string;
  meetingAt: string | null;
}

interface LeadMetrics {
  newCount: number;
  contactedCount: number;
  meetingCount: number;
  convertedCount: number;
}

const SUGGESTED_PLAN_LABEL: Record<string, string> = { gratis: "Agenda interna (histórico)", "agenda-interna": "Agenda interna", esencial: "Esencial", profesional: "Profesional", empresa: "Empresa" };
const ALL = "all";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export default function SuperadminLeadsPage() {
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<string>(ALL);
  const [plan, setPlan] = React.useState<string>(ALL);
  const [industry, setIndustry] = React.useState<string>(ALL);
  const [leads, setLeads] = React.useState<LeadListItem[] | null>(null);
  const [metrics, setMetrics] = React.useState<LeadMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status !== ALL) params.set("status", status);
    if (plan !== ALL) params.set("plan", plan);
    if (industry !== ALL) params.set("industry", industry);

    const timeout = setTimeout(() => {
      requestJson<{ leads: LeadListItem[]; metrics: LeadMetrics }>(`/api/superadmin/leads?${params.toString()}`)
        .then(({ leads, metrics }) => {
          setLeads(leads);
          setMetrics(metrics);
        })
        .catch(() => setLeads([]))
        .finally(() => setLoading(false));
    }, 250);

    return () => clearTimeout(timeout);
  }, [q, status, plan, industry]);

  return (
    <div className="space-y-6">
      <PageHeader title="Leads" description="Evaluaciones enviadas desde la landing — potenciales clientes para contactar." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={UserPlus} label="Nuevos" value={metrics ? String(metrics.newCount) : null} />
        <MetricCard icon={Users} label="Contactados" value={metrics ? String(metrics.contactedCount) : null} />
        <MetricCard icon={CalendarCheck2} label="Reuniones" value={metrics ? String(metrics.meetingCount) : null} />
        <MetricCard icon={UserCheck} label="Convertidos" value={metrics ? String(metrics.convertedCount) : null} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, negocio, email..." className="pl-9" />
        </div>

        <Select value={status} onValueChange={(v) => setStatus(v ?? ALL)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los estados</SelectItem>
            {LEAD_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {LEAD_STATUS_META[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={plan} onValueChange={(v) => setPlan(v ?? ALL)}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Plan sugerido" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los planes</SelectItem>
            {Object.entries(SUGGESTED_PLAN_LABEL).map(([slug, label]) => (
              <SelectItem key={slug} value={slug}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={industry} onValueChange={(v) => setIndustry(v ?? ALL)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Rubro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los rubros</SelectItem>
            {BUSINESS_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Negocio</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 font-medium">Rubro</th>
              <th className="px-4 py-3 font-medium">Interés principal</th>
              <th className="px-4 py-3 font-medium">Plan sugerido</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Reunión</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={8}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : !leads || leads.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                  No hay leads que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <Link href={`/superadmin/leads/${lead.id}`} className="font-medium text-foreground hover:underline">
                      {lead.businessName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-foreground">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">{lead.whatsapp}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{lead.industry}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.goals[0] ? LEAD_GOAL_LABEL[lead.goals[0]] : "—"}
                    {lead.goals.length > 1 && <span className="text-xs"> +{lead.goals.length - 1}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.suggestedPlan ? (SUGGESTED_PLAN_LABEL[lead.suggestedPlan] ?? lead.suggestedPlan) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={LEAD_STATUS_META[lead.status].className}>
                      {LEAD_STATUS_META[lead.status].label}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{dateFormatter.format(new Date(lead.createdAt))}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.meetingAt ? dateTimeFormatter.format(new Date(lead.meetingAt)) : "—"}
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
