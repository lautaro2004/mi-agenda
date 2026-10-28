"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Loader2, Lock, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SiteBannerDialog } from "@/components/dashboard/site-banner-dialog";
import { requestJson } from "@/lib/api-client";
import {
  BANNER_KIND,
  insertBannerItem,
  moveItem,
  removeBannerItem,
  setItemVisible,
  type BuiltinSectionDef,
  type SectionItem,
} from "@/lib/site-sections";
import { cn } from "@/lib/utils";
import type { SiteBanner, SiteTemplate } from "@/lib/types";

interface LayoutResponse {
  template: SiteTemplate;
  items: SectionItem[];
  sections: BuiltinSectionDef[];
  banners: SiteBanner[];
  hints: Record<string, string>;
  contacts: { whatsapp: boolean; phone: boolean };
}

const TEMPLATE_LABEL: Record<SiteTemplate, string> = {
  institutional: "Institucional",
  booking: "Reservas",
  leads: "Captación de clientes",
};

// Primera versión simple del editor modular: lista ordenada de secciones con
// orden, visibilidad y banners. Cada cambio se guarda en el servidor como
// una lista completa (una sola escritura): si falla, vuelve al estado
// anterior. El arrastre es opcional; ↑/↓ cubren teclado y celular.
export function SiteSectionsEditor() {
  const [data, setData] = React.useState<LayoutResponse | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addBannerId, setAddBannerId] = React.useState("");
  const [addAfter, setAddAfter] = React.useState("0");
  const [editingBanner, setEditingBanner] = React.useState<SiteBanner | null>(null);
  const [deleting, setDeleting] = React.useState<SectionItem | null>(null);
  const [announce, setAnnounce] = React.useState("");

  const load = React.useCallback(() => {
    setLoadError(false);
    requestJson<LayoutResponse>("/api/business/site-layout")
      .then(setData)
      .catch(() => setLoadError(true));
  }, []);

  React.useEffect(load, [load]);

  // Persiste la lista completa. Optimista: se muestra ya, y si el servidor la
  // rechaza se vuelve a la lista anterior (nunca queda un orden que no esté
  // guardado).
  async function commit(next: SectionItem[], message?: string) {
    if (!data || saving) return;
    const previous = data.items;
    setData({ ...data, items: next });
    setSaving(true);
    try {
      const result = await requestJson<{ items: SectionItem[]; navWarnings?: string[] }>("/api/business/site-layout", {
        method: "PUT",
        body: JSON.stringify({ template: data.template, items: next }),
      });
      setData((prev) => (prev ? { ...prev, items: result.items } : prev));
      if (message) setAnnounce(message);
      if (result.navWarnings && result.navWarnings.length > 0) {
        toast.warning(`Estos enlaces de la navegación apuntan a una sección oculta y no se muestran: ${result.navWarnings.join(", ")}. Corregilos en Navegación.`);
      }
    } catch (error) {
      setData((prev) => (prev ? { ...prev, items: previous } : prev));
      toast.error(error instanceof Error ? error.message : "No pudimos guardar el cambio.");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        No pudimos cargar las secciones de tu página. Recargá para volver a intentar.
      </div>
    );
  }
  if (!data) return <Skeleton className="h-64 rounded-2xl" />;

  const { template, items, sections, banners, hints } = data;
  const defOf = (kind: string) => sections.find((s) => s.kind === kind);
  const bannerOf = (id?: string) => banners.find((b) => b.id === id);
  const pinned = sections.find((s) => s.pinnedFirst)?.kind;

  function labelOf(item: SectionItem): string {
    return item.kind === BANNER_KIND ? bannerOf(item.bannerId)?.name ?? "Banner" : defOf(item.kind)?.label ?? item.kind;
  }

  function move(from: number, to: number) {
    const next = moveItem(template, items, from, to);
    if (next === items) return;
    void commit(next, `${labelOf(items[from])} movida a la posición ${to + 1}.`);
  }

  function toggle(item: SectionItem) {
    void commit(setItemVisible(template, items, item.id, !item.visible), `${labelOf(item)} ${item.visible ? "oculta" : "visible"}.`);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    await commit(removeBannerItem(items, target.id), "Banner quitado de la página.");
  }

  function addBanner() {
    if (!addBannerId) return;
    setAddOpen(false);
    void commit(insertBannerItem(items, addBannerId, Number(addAfter)), "Banner agregado a la página.");
    setAddBannerId("");
  }

  const canAddBanners = banners.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Secciones de la página</h3>
          <p className="mt-1 max-w-xl text-xs text-muted-foreground">
            Ordená y mostrá u ocultá las secciones de tu plantilla <span className="font-medium text-foreground">{TEMPLATE_LABEL[template]}</span>.
            Ocultar una sección no borra su contenido: podés volver a mostrarla cuando quieras.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Guardando" />}
          <Button type="button" size="sm" onClick={() => setAddOpen(true)} disabled={saving || !canAddBanners}>
            <Plus className="size-3.5" data-icon="inline-start" />
            Agregar banner
          </Button>
        </div>
      </div>

      {!canAddBanners && (
        <p className="mt-3 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Para agregar banners entre secciones, primero creá uno en{" "}
          <Link href="/dashboard/sitio/galeria" className="font-medium text-foreground underline underline-offset-2">
            Contenido visual
          </Link>
          .
        </p>
      )}

      <p className="sr-only" aria-live="polite">
        {announce}
      </p>

      <ol className="mt-5 space-y-2">
        {items.map((item, index) => {
          const isBanner = item.kind === BANNER_KIND;
          const def = isBanner ? undefined : defOf(item.kind);
          const banner = isBanner ? bannerOf(item.bannerId) : undefined;
          const isPinned = !!pinned && item.kind === pinned;
          const locked = !!def?.locked;
          const hint = !isBanner ? hints[item.kind] : banner && !banner.active ? "Este banner está inactivo: no se muestra." : undefined;
          const canDrag = !isPinned && !saving;
          const firstMovable = pinned ? 1 : 0;

          return (
            <li
              key={item.id}
              draggable={canDrag}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                if (dragIndex === null) return;
                if (pinned && index === 0) return;
                e.preventDefault();
                setOverIndex(index);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) move(dragIndex, index);
                setDragIndex(null);
                setOverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setOverIndex(null);
              }}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background p-3 transition-colors",
                !item.visible && "opacity-60",
                overIndex === index && dragIndex !== null && dragIndex !== index && "border-primary bg-primary/5"
              )}
            >
              <span className={cn("text-muted-foreground", canDrag ? "cursor-grab" : "opacity-30")} aria-hidden>
                <GripVertical className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {isBanner && <Megaphone className="size-3.5 text-muted-foreground" aria-hidden />}
                  <span className="truncate text-sm font-medium text-foreground">{labelOf(item)}</span>
                  <Badge variant="outline">{isBanner ? "Banner" : "Sección"}</Badge>
                  <Badge variant={item.visible ? "secondary" : "outline"}>{item.visible ? "Visible" : "Oculta"}</Badge>
                  {locked && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="size-3" aria-hidden />
                      Obligatoria
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isBanner ? banner?.title || "Promoción de tu sitio" : def?.description}
                </p>
                {hint && <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">{hint}</p>}
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={saving || isPinned || index <= firstMovable}
                  onClick={() => move(index, index - 1)}
                  aria-label={`Subir ${labelOf(item)}`}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={saving || isPinned || index === items.length - 1}
                  onClick={() => move(index, index + 1)}
                  aria-label={`Bajar ${labelOf(item)}`}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={saving || locked}
                  onClick={() => toggle(item)}
                  aria-label={`${item.visible ? "Ocultar" : "Mostrar"} ${labelOf(item)}`}
                  title={locked ? "Esta sección es obligatoria" : item.visible ? "Ocultar" : "Mostrar"}
                >
                  {item.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </Button>
                {isBanner ? (
                  <>
                    <Button type="button" variant="ghost" size="icon-sm" disabled={!banner} onClick={() => banner && setEditingBanner(banner)} aria-label={`Editar ${labelOf(item)}`}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" className="text-destructive" disabled={saving} onClick={() => setDeleting(item)} aria-label={`Quitar ${labelOf(item)} de la página`}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                ) : (
                  def && (
                    <Button type="button" variant="outline" size="sm" render={<Link href={def.editHref} />} nativeButton={false}>
                      <Pencil className="size-3.5" data-icon="inline-start" />
                      {def.editLabel}
                    </Button>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Agregar banner a la página</DialogTitle>
            <DialogDescription>
              Elegí un banner y dónde mostrarlo. Podés usar el mismo banner en varias posiciones sin duplicarlo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">Banner</p>
              <Select value={addBannerId} onValueChange={(v) => setAddBannerId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{bannerOf(addBannerId)?.name ?? "Elegí un banner"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {banners.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                      {b.active ? "" : " (inactivo)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">Ubicación</p>
              <Select value={addAfter} onValueChange={(v) => setAddAfter(v ?? "0")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{`Después de ${labelOf(items[Number(addAfter)] ?? items[0])}`}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {items.map((item, index) => (
                    <SelectItem key={item.id} value={String(index)}>
                      Después de {labelOf(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={addBanner} disabled={!addBannerId}>
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Quitar este banner de la página?</DialogTitle>
            <DialogDescription>
              Se saca esta ubicación de tu página. El banner sigue guardado en Contenido visual y lo podés volver a agregar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleting(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()}>
              Quitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SiteBannerDialog
        open={editingBanner !== null}
        onOpenChange={(open) => !open && setEditingBanner(null)}
        banner={editingBanner ?? undefined}
        sections={sections.map((s) => ({ kind: s.kind, label: s.label }))}
        contacts={data.contacts}
        onSaved={(saved) =>
          setData((prev) => (prev ? { ...prev, banners: prev.banners.map((b) => (b.id === saved.id ? saved : b)) } : prev))
        }
      />
    </div>
  );
}
