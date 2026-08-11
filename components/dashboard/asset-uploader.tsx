"use client";

import * as React from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ASSET_LIMITS, type SiteAssetKind } from "@/lib/asset-limits";

interface AssetUploaderProps {
  kind: SiteAssetKind;
  value: string | null;
  onChange: (url: string | null) => void;
  shape?: "square" | "wide";
}

const LABEL: Record<SiteAssetKind, { change: string; upload: string }> = {
  logo: { change: "Cambiar logo", upload: "Subir logo" },
  hero: { change: "Cambiar imagen", upload: "Subir imagen" },
};

// Persiste apenas se elige un archivo (sube, actualiza la referencia y
// borra el anterior server-side — ver modules/business/assets.ts), en vez
// de esperar a un botón "Guardar" externo: es la misma lógica tanto en
// /dashboard/sitio como en el paso de logo del onboarding, sin duplicarla.
// Nunca confía solo en la validación de acá — el servidor revalida mime y
// tamaño con los mismos límites (lib/asset-limits.ts).
export function AssetUploader({ kind, value, onChange, shape = "square" }: AssetUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const objectUrlRef = React.useRef<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  const limits = ASSET_LIMITS[kind];

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);

    if (!limits.mimeTypes.includes(file.type)) {
      const formats = limits.mimeTypes.map((m) => m.split("/")[1].toUpperCase()).join(", ");
      setError(`Formato no permitido. Usá ${formats}.`);
      return;
    }
    if (file.size > limits.maxBytes) {
      setError(`El archivo supera el máximo de ${Math.round(limits.maxBytes / (1024 * 1024))} MB.`);
      return;
    }

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const localUrl = URL.createObjectURL(file);
    objectUrlRef.current = localUrl;
    setPreview(localUrl);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`/api/business/assets/${kind}`, { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !data?.url) throw new Error(data?.error ?? "No pudimos subir el archivo.");

      onChange(data.url);
      toast.success(kind === "logo" ? "Logo actualizado." : "Imagen actualizada.");
    } catch (err) {
      // El archivo/referencia anterior no se tocaron — "value" sigue siendo
      // la fuente de verdad hasta que una subida termine bien.
      setError(err instanceof Error ? err.message : "No pudimos subir el archivo.");
    } finally {
      setUploading(false);
      setPreview(null);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError(null);
    setUploading(true);
    try {
      const response = await fetch(`/api/business/assets/${kind}`, { method: "DELETE" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "No pudimos quitar el archivo.");
      onChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos quitar el archivo.");
    } finally {
      setUploading(false);
    }
  }

  const displayUrl = preview ?? value;

  return (
    <div className="flex items-start gap-4">
      <div
        className={cn(
          "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-muted text-muted-foreground",
          displayUrl && "border-solid",
          shape === "square" ? "size-20" : "h-20 w-36"
        )}
      >
        {uploading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt="" className="size-full object-cover" />
        ) : (
          <ImagePlus className="size-6" />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={limits.mimeTypes.join(",")}
          className="hidden"
          disabled={uploading}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
          {uploading ? "Subiendo…" : value ? LABEL[kind].change : LABEL[kind].upload}
        </Button>
        {value && !uploading && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => void handleRemove()}
          >
            <X className="size-3.5" data-icon="inline-start" />
            Quitar
          </Button>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
