"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SiteBannerDialog, type BannerSectionOption } from "@/components/dashboard/site-banner-dialog";
import { requestJson } from "@/lib/api-client";
import { BANNER_VARIANT_LABEL } from "@/lib/site-banners";
import type { SectionItem } from "@/lib/site-sections";
import type { SiteBanner } from "@/lib/types";

interface LayoutResponse {
  items: SectionItem[];
  sections: { kind: string; label: string }[];
  contacts: { whatsapp: boolean; phone: boolean };
  banners: SiteBanner[];
}

// Biblioteca de banners (Contenido visual). Acá se crean y editan; dónde se
// muestran se decide en "Secciones de la página" (Sitio web), por referencia:
// un banner usado en varias posiciones no se duplica.
export function BannersManager({ enabled }: { enabled: boolean }) {
  const [data, setData] = React.useState<LayoutResponse | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [editing, setEditing] = React.useState<SiteBanner | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<SiteBanner | null>(null);
  const [deletePending, setDeletePending] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoadError(false);
    requestJson<LayoutResponse>("/api/business/site-layout")
      .then(setData)
      .catch(() => setLoadError(true));
  }, []);

  React.useEffect(load, [load]);

  function upsert(banner: SiteBanner) {
    setData((prev) => {
      if (!prev) return prev;
      const exists = prev.banners.some((b) => b.id === banner.id);
      return { ...prev, banners: exists ? prev.banners.map((b) => (b.id === banner.id ? banner : b)) : [...prev.banners, banner] };
    });
  }

  async function toggleActive(banner: SiteBanner, active: boolean) {
    setTogglingId(banner.id);
    try {
      const { banner: updated } = await requestJson<{ banner: SiteBanner }>(`/api/business/banners/${banner.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      });
      upsert(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar el banner.");
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await requestJson(`/api/business/banners/${deleting.id}`, { method: "DELETE" });
      toast.success("Banner eliminado.");
      setDeleting(null);
      // Recarga: también se sacan sus posiciones de la página.
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos eliminar el banner.");
    } finally {
      setDeletePending(false);
    }
  }

  const sections: BannerSectionOption[] = data?.sections ?? [];
  const usage = (id: string) => data?.items.filter((i) => i.bannerId === id).length ?? 0;

  return (
    <section className="mb-10" aria-labelledby="banners-title">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id="banners-title" className="text-base font-semibold text-foreground">
            Banners promocionales
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Imágenes con título y botón para promociones. Después los ubicás entre las secciones desde Sitio web.
          </p>
        </div>
        <Button onClick={() => setCreating(true)} disabled={!enabled || !data}>
          <Plus className="size-4" data-icon="inline-start" />
          Nuevo banner
        </Button>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          No pudimos cargar los banners. Recargá la página para volver a intentar.
        </div>
      ) : !data ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : data.banners.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-center">
          <Megaphone className="size-7 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Todavía no creaste banners</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Creá uno para destacar una promoción, un servicio o un llamado a la acción.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.banners.map((banner) => {
            const used = usage(banner.id);
            return (
              <li key={banner.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 sm:flex-row sm:items-center">
                <div className="h-20 w-full shrink-0 overflow-hidden rounded-xl bg-muted sm:w-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={banner.desktopImageUrl} alt="" className="size-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{banner.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{BANNER_VARIANT_LABEL[banner.variant].label}</Badge>
                    <Badge variant={banner.active ? "secondary" : "outline"}>{banner.active ? "Activo" : "Inactivo"}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {used === 0 ? "Sin ubicar en la página" : used === 1 ? "En 1 ubicación" : `En ${used} ubicaciones`}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={banner.active}
                    disabled={!enabled || togglingId === banner.id}
                    onCheckedChange={(checked) => void toggleActive(banner, checked)}
                    aria-label={`${banner.active ? "Desactivar" : "Activar"} ${banner.name}`}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditing(banner)}>
                    <Pencil className="size-3.5" data-icon="inline-start" />
                    Editar
                  </Button>
                  <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" aria-label={`Eliminar ${banner.name}`} onClick={() => setDeleting(banner)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SiteBannerDialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
        banner={editing ?? undefined}
        sections={sections}
        contacts={data?.contacts ?? { whatsapp: false, phone: false }}
        onSaved={upsert}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && !deletePending && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Eliminar este banner?</DialogTitle>
            <DialogDescription>
              Se va a quitar &ldquo;{deleting?.name}&rdquo; de todas las ubicaciones de tu página y se borran sus imágenes. No se puede deshacer.
              Si solo querés dejar de mostrarlo, desactivalo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)} disabled={deletePending}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()} disabled={deletePending}>
              {deletePending && <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
