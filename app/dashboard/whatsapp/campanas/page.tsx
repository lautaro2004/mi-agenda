"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Archive, Info, Megaphone, Pause, Pencil, Play, Plus } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";
import { useBusinessRole } from "@/lib/business-role";
import {
  CAMPAIGN_CHANNEL_LABEL,
  CAMPAIGN_GOAL_LABEL,
  CAMPAIGN_STATUS_LABEL,
  type CampaignListItem,
  type CampaignStatus,
} from "@/lib/campaigns";

const STATUS_VARIANT: Record<CampaignStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  paused: "secondary",
  draft: "outline",
  archived: "outline",
};

const dateFmt = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" });

export default function CampaignsPage() {
  const role = useBusinessRole();
  const canEdit = role === "owner" || role === "admin";
  const [items, setItems] = useState<CampaignListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await requestJson<{ campaigns: CampaignListItem[] }>("/api/whatsapp/campaigns");
      setItems(data.campaigns);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar las campañas.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(item: CampaignListItem, status: CampaignStatus) {
    setBusyId(item.id);
    try {
      await requestJson(`/api/whatsapp/campaigns/${item.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      toast.success(status === "active" ? "Campaña activada." : status === "paused" ? "Campaña pausada." : "Campaña archivada.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos cambiar el estado.");
    } finally {
      setBusyId(null);
    }
  }

  const visible = (items ?? []).filter((c) => showArchived || c.status !== "archived");
  const archivedCount = (items ?? []).filter((c) => c.status === "archived").length;

  return (
    <div>
      <PageHeader
        title="Campañas de WhatsApp"
        description="Anuncios que llevan a tu WhatsApp y cómo debe responder el agente a cada uno."
        action={
          canEdit && (
            <Button render={<Link href="/dashboard/whatsapp/campanas/nueva" />} nativeButton={false}>
              <Plus className="size-4" data-icon="inline-start" />
              Nueva campaña
            </Button>
          )
        }
      />

      <p className="mb-4 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        El origen se infiere por el mensaje precargado del anuncio (WhatsApp conectado por QR no informa de qué anuncio viene cada persona). Reservas y oportunidades ganadas por campaña todavía no se miden.
      </p>

      {error && <Card className="p-4 text-sm text-destructive">{error}</Card>}

      {!error && items === null && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {items && visible.length === 0 && (
        <Card className="items-center gap-3 p-10 text-center">
          <Megaphone className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">Todavía no creaste campañas</p>
          <p className="max-w-md text-sm text-muted-foreground">Creá una campaña para definir el mensaje de tu anuncio, qué promocionás y qué datos debe pedir el agente.</p>
          {canEdit && (
            <Button render={<Link href="/dashboard/whatsapp/campanas/nueva" />} nativeButton={false}>
              Crear la primera campaña
            </Button>
          )}
        </Card>
      )}

      <div className="space-y-3">
        {visible.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium text-foreground">{c.name}</h2>
                  <Badge variant={STATUS_VARIANT[c.status]}>{CAMPAIGN_STATUS_LABEL[c.status]}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {CAMPAIGN_GOAL_LABEL[c.goal]} · {CAMPAIGN_CHANNEL_LABEL[c.channel]} · creada el {dateFmt.format(new Date(c.createdAt))}
                </p>
              </div>
              {canEdit && c.status !== "archived" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" render={<Link href={`/dashboard/whatsapp/campanas/${c.id}`} />} nativeButton={false}>
                    <Pencil className="size-3.5" data-icon="inline-start" />Editar
                  </Button>
                  {c.status === "active" ? (
                    <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => changeStatus(c, "paused")}>
                      <Pause className="size-3.5" data-icon="inline-start" />Pausar
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => changeStatus(c, "active")}>
                      <Play className="size-3.5" data-icon="inline-start" />Activar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" disabled={busyId === c.id} onClick={() => changeStatus(c, "archived")}>
                    <Archive className="size-3.5" data-icon="inline-start" />Archivar
                  </Button>
                </div>
              )}
              {canEdit && c.status === "archived" && (
                <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => changeStatus(c, "paused")}>
                  Restaurar como pausada
                </Button>
              )}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ["Conversaciones", c.stats.conversations],
                ["Leads", c.stats.leads],
                ["Calificados", c.stats.qualified],
                ["Pedidos de propuesta", c.stats.proposalRequests],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {c.stats.conversations === 0 && c.status === "active" && (
              <p className="mt-2 text-xs text-muted-foreground">Todavía no llegaron conversaciones identificadas con esta campaña.</p>
            )}
          </Card>
        ))}
      </div>

      {archivedCount > 0 && (
        <button type="button" className="mt-4 text-xs text-muted-foreground underline underline-offset-2" onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Ocultar archivadas" : `Ver archivadas (${archivedCount})`}
        </button>
      )}
    </div>
  );
}
