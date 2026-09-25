"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CalendarClock,
  Check,
  Mail,
  MessageCircle,
  Sparkles,
  Store,
  Tag,
  User,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleMeetingDialog } from "@/components/superadmin/schedule-meeting-dialog";
import { requestJson } from "@/lib/api-client";
import { buildWhatsappHref } from "@/lib/whatsapp-link";
import {
  LEAD_GOAL_LABEL,
  LEAD_MONTHLY_VOLUME_LABEL,
  LEAD_STATUS_META,
  type LeadGoal,
  type LeadMonthlyVolume,
  type LeadStatus,
} from "@/lib/types";

interface LeadDetail {
  id: string;
  name: string;
  businessName: string;
  whatsapp: string;
  email: string;
  industry: string;
  goals: LeadGoal[];
  monthlyVolume: LeadMonthlyVolume | null;
  message: string | null;
  wantsMeeting: boolean;
  status: LeadStatus;
  suggestedPlan: string | null;
  notes: string | null;
  createdAt: string;
  contactedAt: string | null;
  meetingAt: string | null;
  convertedAt: string | null;
  convertedBusinessId: string | null;
  convertedBusiness: { id: string; name: string; slug: string | null } | null;
}

const SUGGESTED_PLAN_LABEL: Record<string, string> = { gratis: "Agenda interna (histórico)", "agenda-interna": "Agenda interna", esencial: "Esencial", profesional: "Profesional", empresa: "Empresa" };

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Row({ icon: Icon, label, value }: { icon: typeof User; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4 last:border-0 last:pb-0">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function BusinessLinker({ lead, onLinked }: { lead: LeadDetail; onLinked: () => void }) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<{ id: string; name: string }[]>([]);
  const [linking, setLinking] = React.useState(false);

  React.useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      requestJson<{ businesses: { id: string; name: string }[] }>(`/api/superadmin/empresas?q=${encodeURIComponent(q.trim())}`)
        .then(({ businesses }) => setResults(businesses.slice(0, 6)))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timeout);
  }, [q]);

  async function link(businessId: string) {
    setLinking(true);
    try {
      await requestJson(`/api/superadmin/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ convertedBusinessId: businessId }),
      });
      toast.success("Negocio vinculado");
      setQ("");
      setResults([]);
      onLinked();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos vincular el negocio.");
    } finally {
      setLinking(false);
    }
  }

  async function unlink() {
    setLinking(true);
    try {
      await requestJson(`/api/superadmin/leads/${lead.id}`, {
        method: "PATCH",
        body: JSON.stringify({ convertedBusinessId: "" }),
      });
      onLinked();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos desvincular el negocio.");
    } finally {
      setLinking(false);
    }
  }

  if (lead.convertedBusiness) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-sm">
        <Link href={`/superadmin/empresas/${lead.convertedBusiness.id}`} className="font-medium text-foreground hover:underline">
          {lead.convertedBusiness.name}
        </Link>
        <Button size="icon-sm" variant="ghost" onClick={() => void unlink()} disabled={linking} aria-label="Desvincular">
          <X className="size-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar negocio existente para vincular..." disabled={linking} />
      {results.length > 0 && (
        <div className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-md">
          {results.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => void link(b.id)}
              className="block w-full px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
            >
              {b.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const [lead, setLead] = React.useState<LeadDetail | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [notes, setNotes] = React.useState("");
  const [savingNotes, setSavingNotes] = React.useState(false);
  const [updatingStatus, setUpdatingStatus] = React.useState(false);

  const load = React.useCallback(() => {
    setLoadError(false);
    requestJson<{ lead: LeadDetail }>(`/api/superadmin/leads/${params.id}`)
      .then(({ lead }) => {
        setLead(lead);
        setNotes(lead.notes ?? "");
      })
      .catch(() => setLoadError(true));
  }, [params.id]);

  React.useEffect(load, [load]);

  async function setStatus(status: LeadStatus) {
    setUpdatingStatus(true);
    try {
      const { lead: updated } = await requestJson<{ lead: LeadDetail }>(`/api/superadmin/leads/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setLead(updated);
      toast.success(`Marcado como ${LEAD_STATUS_META[status].label.toLowerCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar el lead.");
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function scheduleMeeting(meetingAt: string) {
    try {
      const { lead: updated } = await requestJson<{ lead: LeadDetail }>(`/api/superadmin/leads/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ meetingAt }),
      });
      setLead(updated);
      toast.success("Reunión coordinada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar la reunión.");
    }
  }

  async function saveNotes() {
    setSavingNotes(true);
    try {
      const { lead: updated } = await requestJson<{ lead: LeadDetail }>(`/api/superadmin/leads/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ notes }),
      });
      setLead(updated);
      toast.success("Notas guardadas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar las notas.");
    } finally {
      setSavingNotes(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        No pudimos cargar el lead. Recargá la página para volver a intentar.
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  const whatsappHref = buildWhatsappHref(
    lead.whatsapp,
    `Hola ${lead.name}, soy de Nexo. Vi que nos dejaste una consulta sobre cómo podríamos ayudarte con ${lead.businessName}. Quería conocer un poco más sobre tu negocio y contarte qué podríamos implementar.`
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Button size="sm" variant="ghost" render={<Link href="/superadmin/leads" />} nativeButton={false} className="mb-2 -ml-2">
          <ArrowLeft className="size-3.5" data-icon="inline-start" />
          Volver a leads
        </Button>
        <PageHeader title={lead.businessName} description={`Lead enviado el ${dateFormatter.format(new Date(lead.createdAt))}`} />
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Datos del contacto</h3>
          <Badge variant="outline" className={LEAD_STATUS_META[lead.status].className}>
            {LEAD_STATUS_META[lead.status].label}
          </Badge>
        </div>
        <dl className="mt-5 space-y-4 text-sm">
          <Row icon={User} label="Nombre" value={lead.name} />
          <Row icon={Building2} label="Negocio" value={lead.businessName} />
          <Row icon={MessageCircle} label="WhatsApp" value={lead.whatsapp} />
          <Row icon={Mail} label="Email" value={lead.email} />
          <Row icon={Store} label="Rubro" value={lead.industry} />
        </dl>

        {whatsappHref && (
          <Button className="mt-5 w-full" render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />} nativeButton={false}>
            <MessageCircle className="size-4" data-icon="inline-start" />
            Contactar por WhatsApp
          </Button>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground">Necesidades</h3>
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <p className="text-muted-foreground">Qué quiere mejorar</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lead.goals.map((g) => (
                <Badge key={g} variant="outline">
                  {LEAD_GOAL_LABEL[g]}
                </Badge>
              ))}
            </div>
          </div>
          <Row icon={Tag} label="Volumen aproximado" value={lead.monthlyVolume ? LEAD_MONTHLY_VOLUME_LABEL[lead.monthlyVolume] : "No indicado"} />
          {lead.message && (
            <div>
              <p className="text-muted-foreground">Mensaje</p>
              <p className="mt-1.5 rounded-lg bg-muted/40 px-3 py-2.5 text-foreground">{lead.message}</p>
            </div>
          )}
          <Row icon={CalendarClock} label="Quiere coordinar reunión" value={lead.wantsMeeting ? "Sí" : "Prefiere info primero"} />
        </div>
      </div>

      <div className="rounded-2xl border border-primary/30 bg-primary/[0.03] p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h3 className="text-base font-semibold text-foreground">Recomendación</h3>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Plan sugerido:{" "}
          <span className="font-medium text-foreground">
            {lead.suggestedPlan ? (SUGGESTED_PLAN_LABEL[lead.suggestedPlan] ?? lead.suggestedPlan) : "Sin calcular"}
          </span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Orientativo, calculado por reglas simples — no reemplaza tu criterio.</p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <h3 className="text-base font-semibold text-foreground">Seguimiento</h3>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={updatingStatus} onClick={() => void setStatus("CONTACTED")}>
            Marcar contactado
          </Button>
          <ScheduleMeetingDialog
            currentMeetingAt={lead.meetingAt}
            onSchedule={scheduleMeeting}
            trigger={
              <Button size="sm" variant="outline">
                Coordinar reunión
              </Button>
            }
          />
          <Button size="sm" variant="outline" disabled={updatingStatus} onClick={() => void setStatus("PROPOSAL")}>
            Marcar propuesta
          </Button>
          <Button size="sm" variant="outline" disabled={updatingStatus} onClick={() => void setStatus("CONVERTED")}>
            <Check className="size-3.5" data-icon="inline-start" />
            Marcar convertido
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" disabled={updatingStatus} onClick={() => void setStatus("LOST")}>
            Marcar perdido
          </Button>
        </div>

        <dl className="mt-5 space-y-4 text-sm">
          <Row icon={Calendar} label="Fecha de contacto" value={lead.contactedAt ? dateTimeFormatter.format(new Date(lead.contactedAt)) : "—"} />
          <Row icon={Calendar} label="Fecha de reunión" value={lead.meetingAt ? dateTimeFormatter.format(new Date(lead.meetingAt)) : "—"} />
          <Row icon={Calendar} label="Fecha de conversión" value={lead.convertedAt ? dateTimeFormatter.format(new Date(lead.convertedAt)) : "—"} />
        </dl>

        <div className="mt-5">
          <p className="text-sm text-muted-foreground">Negocio vinculado</p>
          <div className="mt-2">
            <BusinessLinker lead={lead} onLinked={load} />
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm text-muted-foreground">Notas internas</p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mt-2"
            placeholder="Notas de seguimiento, solo visibles para vos..."
          />
          <Button size="sm" className="mt-2" disabled={savingNotes} onClick={() => void saveNotes()}>
            {savingNotes ? "Guardando..." : "Guardar notas"}
          </Button>
        </div>
      </div>
    </div>
  );
}
