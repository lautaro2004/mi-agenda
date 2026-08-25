"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Images, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { GalleryBlockDialog } from "@/components/dashboard/gallery-block-dialog";
import { GalleryBlockCard } from "@/components/dashboard/gallery-block-card";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";
import { useBusinessSubscription } from "@/lib/subscription-client";
import type { GalleryBlock, GalleryImage } from "@/lib/types";
import type { GalleryBlockFormValues } from "@/lib/schemas";

export default function GalleryPage() {
  const [blocks, setBlocks] = React.useState<GalleryBlock[] | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const { data: subscriptionData } = useBusinessSubscription();
  // undefined mientras carga: no bloqueamos "Nuevo bloque" antes de saber el
  // plan real (mismo criterio que app/dashboard/whatsapp/conexion/page.tsx).
  const galleryEnabled = subscriptionData?.subscription?.plan.galleryEnabled ?? true;

  const load = React.useCallback(() => {
    setLoadError(false);
    requestJson<{ blocks: GalleryBlock[] }>("/api/business/gallery")
      .then(({ blocks }) => setBlocks(blocks))
      .catch(() => setLoadError(true));
  }, []);

  React.useEffect(load, [load]);

  async function handleCreate(values: GalleryBlockFormValues) {
    try {
      const { block } = await requestJson<{ block: GalleryBlock }>("/api/business/gallery", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setBlocks((prev) => [...(prev ?? []), block]);
      toast.success("Bloque creado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos crear el bloque.");
    }
  }

  async function handleUpdate(id: string, values: GalleryBlockFormValues & { active?: boolean }) {
    try {
      const { block } = await requestJson<{ block: GalleryBlock }>(`/api/business/gallery/${id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      setBlocks((prev) => (prev ?? []).map((b) => (b.id === id ? block : b)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar el bloque.");
    }
  }

  async function handleMove(id: string, direction: "up" | "down") {
    try {
      const { blocks: updated } = await requestJson<{ blocks: GalleryBlock[] }>(`/api/business/gallery/${id}/move`, {
        method: "POST",
        body: JSON.stringify({ direction }),
      });
      setBlocks(updated);
    } catch {
      toast.error("No pudimos reordenar los bloques.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await requestJson(`/api/business/gallery/${id}`, { method: "DELETE" });
      setBlocks((prev) => (prev ?? []).filter((b) => b.id !== id));
      toast.success("Bloque eliminado");
    } catch {
      toast.error("No pudimos eliminar el bloque.");
    }
  }

  function handleImageAdded(blockId: string, image: GalleryImage) {
    setBlocks((prev) => (prev ?? []).map((b) => (b.id === blockId ? { ...b, images: [...b.images, image] } : b)));
  }

  function handleImageRemoved(blockId: string, imageId: string) {
    setBlocks((prev) =>
      (prev ?? []).map((b) => (b.id === blockId ? { ...b, images: b.images.filter((i) => i.id !== imageId) } : b))
    );
  }

  return (
    <div>
      <PageHeader
        title="Contenido visual"
        description="Administrá fotos y bloques visuales para tu sitio público."
        action={
          galleryEnabled ? (
            <GalleryBlockDialog
              onSubmit={handleCreate}
              trigger={
                <Button>
                  <Plus className="size-4" data-icon="inline-start" />
                  Nuevo bloque
                </Button>
              }
            />
          ) : (
            <Button disabled>
              <Plus className="size-4" data-icon="inline-start" />
              Nuevo bloque
            </Button>
          )
        }
      />

      {!galleryEnabled && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <p className="text-foreground">La galería de fotos está disponible desde el plan Esencial.</p>
          <Button size="sm" className="mt-3" render={<Link href="/dashboard/suscripcion" />} nativeButton={false}>
            Ver planes
          </Button>
        </div>
      )}

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          No pudimos cargar el contenido visual. Recargá la página para volver a intentar.
        </div>
      ) : !blocks ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Images className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Todavía no agregaste contenido visual</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Creá un bloque con fotos de tu local, tus productos o tu equipo — aparece automáticamente en tu sitio
            público.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {blocks.map((block, index) => (
            <GalleryBlockCard
              key={block.id}
              block={block}
              isFirst={index === 0}
              isLast={index === blocks.length - 1}
              onUpdate={(values) => handleUpdate(block.id, values)}
              onMove={(direction) => handleMove(block.id, direction)}
              onDelete={() => handleDelete(block.id)}
              onImageAdded={(image) => handleImageAdded(block.id, image)}
              onImageRemoved={(imageId) => handleImageRemoved(block.id, imageId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
