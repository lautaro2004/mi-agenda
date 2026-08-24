"use client";

import * as React from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Pencil, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { GalleryBlockDialog } from "@/components/dashboard/gallery-block-dialog";
import { ASSET_LIMITS } from "@/lib/asset-limits";
import type { GalleryBlock, GalleryImage } from "@/lib/types";
import type { GalleryBlockFormValues } from "@/lib/schemas";

interface GalleryBlockCardProps {
  block: GalleryBlock;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (values: GalleryBlockFormValues & { active?: boolean }) => Promise<void>;
  onMove: (direction: "up" | "down") => Promise<void>;
  onDelete: () => Promise<void>;
  onImageAdded: (image: GalleryImage) => void;
  onImageRemoved: (imageId: string) => void;
}

const limits = ASSET_LIMITS.gallery;

export function GalleryBlockCard({
  block,
  isFirst,
  isLast,
  onUpdate,
  onMove,
  onDelete,
  onImageAdded,
  onImageRemoved,
}: GalleryBlockCardProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);
  const [moving, setMoving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!limits.mimeTypes.includes(file.type)) {
          toast.error(`${file.name}: formato no permitido.`);
          continue;
        }
        if (file.size > limits.maxBytes) {
          toast.error(`${file.name}: supera el máximo de ${Math.round(limits.maxBytes / (1024 * 1024))} MB.`);
          continue;
        }
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`/api/business/gallery/${block.id}/images`, { method: "POST", body: formData });
        const data = (await res.json().catch(() => null)) as { image?: GalleryImage; error?: string } | null;
        if (!res.ok || !data?.image) {
          toast.error(data?.error ?? `No pudimos subir ${file.name}.`);
          continue;
        }
        onImageAdded(data.image);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemoveImage(imageId: string) {
    setRemovingId(imageId);
    try {
      const res = await fetch(`/api/business/gallery/${block.id}/images/${imageId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onImageRemoved(imageId);
    } catch {
      toast.error("No pudimos quitar la imagen.");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleMove(direction: "up" | "down") {
    setMoving(true);
    try {
      await onMove(direction);
    } finally {
      setMoving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar este bloque y todas sus imágenes?")) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{block.title || "Sin título"}</h3>
            {!block.active && (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                Inactivo
              </span>
            )}
          </div>
          {block.description && <p className="mt-1 text-sm text-muted-foreground">{block.description}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button size="icon-sm" variant="ghost" disabled={isFirst || moving} onClick={() => void handleMove("up")} aria-label="Subir">
            <ArrowUp className="size-3.5" />
          </Button>
          <Button size="icon-sm" variant="ghost" disabled={isLast || moving} onClick={() => void handleMove("down")} aria-label="Bajar">
            <ArrowDown className="size-3.5" />
          </Button>
          <GalleryBlockDialog
            block={block}
            onSubmit={(values) => void onUpdate(values)}
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label="Editar bloque">
                <Pencil className="size-3.5" />
              </Button>
            }
          />
          <Switch
            checked={block.active}
            onCheckedChange={(checked) => void onUpdate({ active: checked })}
            aria-label="Bloque activo"
          />
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={deleting}
            onClick={() => void handleDelete()}
            aria-label="Eliminar bloque"
          >
            {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
        {block.images.map((image) => (
          <div key={image.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.imageUrl} alt="" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => void handleRemoveImage(image.id)}
              disabled={removingId === image.id}
              aria-label="Quitar imagen"
              className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-60"
            >
              {removingId === image.id ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3.5" />}
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
          <span className="text-[11px] font-medium">{uploading ? "Subiendo…" : "Agregar"}</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={limits.mimeTypes.join(",")}
          className="hidden"
          disabled={uploading}
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>
    </div>
  );
}
