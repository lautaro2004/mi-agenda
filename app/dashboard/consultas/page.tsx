"use client";

import * as React from "react";
import { toast } from "sonner";
import { Mail, MessageSquareText, Phone, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LeadQualificationCard } from "@/components/dashboard/lead-qualification-card";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/dashboard/page-header";
import { requestJson } from "@/lib/api-client";
import { buildWhatsappHref } from "@/lib/whatsapp-link";
import { formatRelativeTime } from "@/lib/utils";
import type { Inquiry } from "@/lib/types";

type SyncStatus = "synced" | "no_workspace" | "not_configured" | "held" | "error" | "not_found";

const STATUS_LABEL: Record<Inquiry["status"], string> = {
  NEW: "Nueva",
  IN_PROGRESS: "En curso",
  RESOLVED: "Resuelta",
};

const STATUS_BADGE: Record<Inquiry["status"], "default" | "secondary" | "outline"> = {
  NEW: "default",
  IN_PROGRESS: "secondary",
  RESOLVED: "outline",
};

const QUALIFICATION_LABEL: Record<NonNullable<Inquiry["qualificationStatus"]>, string> = {
  pending: "Analizando",
  qualified: "Calificado",
  discarded: "Descartado",
};

const QUALIFICATION_BADGE: Record<NonNullable<Inquiry["qualificationStatus"]>, "default" | "secondary" | "outline"> = {
  pending: "outline",
  qualified: "default",
  discarded: "secondary",
};

export default function InquiriesPage() {
  const [inquiries, setInquiries] = React.useState<Inquiry[] | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [campaignFilter, setCampaignFilter] = React.useState<string>("all");
  const [sending, setSending] = React.useState(false);

  const campaignOptions = React.useMemo(() => {
    const names = new Set<string>();
    for (const i of inquiries ?? []) if (i.campaignName) names.add(i.campaignName);
    return [...names].sort();
  }, [inquiries]);

  const visible = React.useMemo(() => {
    if (!inquiries) return inquiries;
    if (campaignFilter === "all") return inquiries;
    if (campaignFilter === "none") return inquiries.filter((i) => !i.campaignName);
    return inquiries.filter((i) => i.campaignName === campaignFilter);
  }, [inquiries, campaignFilter]);

  const pendingVisible = (visible ?? []).filter((i) => !i.nodoLeadId);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllPending() {
    setSelected(new Set(pendingVisible.slice(0, 50).map((i) => i.id)));
  }

  async function sendSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setSending(true);
    try {
      const { results } = await requestJson<{ results: Array<{ id: string; status: SyncStatus }> }>(
        "/api/business/inquiries/nodo-sync",
        { method: "POST", body: JSON.stringify({ ids }) }
      );
      const ok = results.filter((r) => r.status === "synced").length;
      const failed = results.filter((r) => r.status === "error").length;
      const held = results.filter((r) => r.status === "held").length;
      const notConfigured = results.some((r) => r.status === "not_configured" || r.status === "no_workspace");
      if (ok > 0) toast.success(`${ok} enviado${ok === 1 ? "" : "s"} a Nodo CRM.`);
      if (failed > 0) toast.error(`${failed} no se pudieron enviar. Probá de nuevo en un rato.`);
      if (held > 0) toast.info(`${held} quedaron retenidas: todavía no están calificadas.`);
      if (notConfigured && ok === 0) toast.error("Tu negocio no tiene Nodo CRM conectado.");
      const fresh = await requestJson<{ inquiries: Inquiry[] }>("/api/business/inquiries");
      setInquiries(fresh.inquiries);
      setSelected(new Set(results.filter((r) => r.status !== "synced").map((r) => r.id)));
    } catch {
      toast.error("No pudimos enviar las consultas a Nodo.");
    } finally {
      setSending(false);
    }
  }

  React.useEffect(() => {
    requestJson<{ inquiries: Inquiry[] }>("/api/business/inquiries")
      .then(({ inquiries }) => setInquiries(inquiries))
      .catch(() => {
        setLoadError(true);
        toast.error("No pudimos cargar las consultas.");
      });
  }, []);

  async function changeStatus(id: string, status: Inquiry["status"]) {
    const previous = inquiries;
    setInquiries((prev) => prev?.map((i) => (i.id === id ? { ...i, status } : i)) ?? prev);
    try {
      await requestJson(`/api/business/inquiries/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    } catch {
      setInquiries(previous);
      toast.error("No pudimos actualizar el estado.");
    }
  }

  async function changeQualification(id: string, qualificationStatus: "qualified" | "discarded") {
    const previous = inquiries;
    setInquiries(
      (prev) =>
        prev?.map((i) => (i.id === id ? { ...i, qualificationStatus, qualificationReason: "Marcado a mano" } : i)) ?? prev
    );
    try {
      await requestJson(`/api/business/inquiries/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ qualificationStatus }),
      });
    } catch {
      setInquiries(previous);
      toast.error("No pudimos actualizar la calificación.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Consultas"
        description="Consultas del formulario de tu sitio web e interesados que registró tu asistente por WhatsApp."
      />

      {inquiries === null && !loadError && (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      )}

      {loadError && <p className="text-sm text-muted-foreground">No pudimos cargar las consultas. Recargá la página.</p>}

      {inquiries?.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-10 text-center">
          <MessageSquareText className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Todavía no recibiste consultas.</p>
        </div>
      )}

      {inquiries && inquiries.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <Select value={campaignFilter} onValueChange={(v) => setCampaignFilter(v ?? "all")}>
            <SelectTrigger className="w-56" aria-label="Filtrar por campaña">
              <SelectValue>
                {(v: string) => (v === "all" ? "Todas las campañas" : v === "none" ? "Sin campaña" : v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las campañas</SelectItem>
              <SelectItem value="none">Sin campaña</SelectItem>
              {campaignOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" onClick={selectAllPending} disabled={pendingVisible.length === 0}>
            Elegir las que faltan enviar ({pendingVisible.length})
          </Button>
          {selected.size > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Limpiar
            </Button>
          )}
          <Button type="button" size="sm" className="ml-auto" onClick={sendSelected} disabled={selected.size === 0 || sending}>
            <Send className="size-4" />
            {sending ? "Enviando…" : `Enviar a Nodo (${selected.size})`}
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {visible?.map((inquiry) => {
          const whatsappHref = buildWhatsappHref(inquiry.customerWhatsapp);
          return (
            <div key={inquiry.id} className="rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selected.has(inquiry.id)}
                      onChange={() => toggle(inquiry.id)}
                      aria-label={`Elegir a ${inquiry.customerName}`}
                    />
                    <p className="font-medium text-foreground">{inquiry.customerName}</p>
                    <Badge variant={STATUS_BADGE[inquiry.status]}>{STATUS_LABEL[inquiry.status]}</Badge>
                    <Badge variant="outline">{inquiry.channel === "whatsapp" ? "WhatsApp · asistente" : "Sitio web"}</Badge>
                    {inquiry.campaignName && <Badge variant="secondary">Campaña: {inquiry.campaignName}</Badge>}
                    {inquiry.nodoLeadId && <Badge variant="outline">En Nodo CRM</Badge>}
                    {!inquiry.nodoLeadId && inquiry.nodoSyncError && (
                      <Badge variant="outline" title={inquiry.nodoSyncError}>
                        Falló el envío a Nodo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(inquiry.createdAt)}
                    {inquiry.updatedAt && inquiry.updatedAt !== inquiry.createdAt && inquiry.channel === "whatsapp"
                      ? ` · actualizado ${formatRelativeTime(inquiry.updatedAt)}`
                      : ""}
                  </p>
                </div>
                <Select value={inquiry.status} onValueChange={(value) => changeStatus(inquiry.id, value as Inquiry["status"])}>
                  <SelectTrigger className="w-40" aria-label="Estado de la consulta">
                    <SelectValue>{(value: Inquiry["status"]) => STATUS_LABEL[value]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABEL) as Inquiry["status"][]).map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {inquiry.need ? (
                <p className="mt-3 text-sm text-foreground">
                  <span className="font-medium">Necesita: </span>
                  {inquiry.need}
                </p>
              ) : (
                <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{inquiry.message}</p>
              )}
              {inquiry.summary && (
                <p className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Resumen de la conversación: </span>
                  {inquiry.summary}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Phone className="size-4" />
                  {whatsappHref ? (
                    <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {inquiry.customerWhatsapp}
                    </a>
                  ) : (
                    inquiry.customerWhatsapp
                  )}
                </span>
                {inquiry.customerEmail && (
                  <span className="flex items-center gap-1.5">
                    <Mail className="size-4" />
                    <a href={`mailto:${inquiry.customerEmail}`} className="underline underline-offset-2">
                      {inquiry.customerEmail}
                    </a>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
