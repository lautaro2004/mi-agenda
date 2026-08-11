"use client";

import * as React from "react";
import { toast } from "sonner";
import { AlertCircle, FileText, Loader2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DOCUMENT_LIMITS, DOCUMENT_MIME_LABELS, formatFileSize } from "@/lib/document-limits";
import type { MemoryEntry } from "@/lib/types";

interface UploadItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  status: "uploading" | "error";
  error?: string;
}

interface DocumentUploaderProps {
  onUploaded: (entry: MemoryEntry) => void;
  // La extracción de texto es sincrónica (parte de la misma request de
  // upload — ver POST /api/ai-studio/memory/upload): no hay un estado de
  // "procesando en segundo plano" aparte de "uploading" en sí. Esto avisa
  // cuántos uploads siguen en vuelo para que el caller pueda mostrar el
  // aviso de "no salgas todavía" (ver app/onboarding/page.tsx).
  onUploadingChange?: (count: number) => void;
}

// Sube documentos (PDF/DOCX/TXT) que terminan como MemoryEntry con
// source: "document" — misma tabla/misma "memoria" que ya usa el empleado,
// no una segunda fuente de conocimiento. Reutilizable tanto en el
// onboarding como en AI Studio → Memoria (ver ambos usos).
export function DocumentUploader({ onUploaded, onUploadingChange }: DocumentUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [items, setItems] = React.useState<UploadItem[]>([]);

  React.useEffect(() => {
    onUploadingChange?.(items.filter((i) => i.status === "uploading").length);
  }, [items, onUploadingChange]);

  async function uploadFile(file: File) {
    const localId = crypto.randomUUID();

    if (!DOCUMENT_LIMITS.mimeTypes.includes(file.type)) {
      setItems((prev) => [
        ...prev,
        {
          id: localId,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          status: "error",
          error: "Formato no permitido. Usá PDF, DOCX o TXT.",
        },
      ]);
      return;
    }
    if (file.size > DOCUMENT_LIMITS.maxBytes) {
      setItems((prev) => [
        ...prev,
        {
          id: localId,
          name: file.name,
          size: file.size,
          mimeType: file.type,
          status: "error",
          error: `Supera el máximo de ${Math.round(DOCUMENT_LIMITS.maxBytes / (1024 * 1024))} MB.`,
        },
      ]);
      return;
    }

    setItems((prev) => [
      ...prev,
      { id: localId, name: file.name, size: file.size, mimeType: file.type, status: "uploading" },
    ]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/ai-studio/memory/upload", { method: "POST", body: formData });
      const data = (await response.json().catch(() => null)) as { entry?: MemoryEntry; error?: string } | null;
      if (!response.ok || !data?.entry) throw new Error(data?.error ?? "No pudimos subir el documento.");

      // Una vez lista, la entrada ya vive en la lista persistente que
      // mantenga el caller (onUploaded) — no la duplicamos acá.
      setItems((prev) => prev.filter((i) => i.id !== localId));
      if (data.entry.processingStatus === "error") {
        toast.error(`"${file.name}" se subió, pero no pudimos leer su contenido.`);
      } else {
        toast.success(`"${file.name}" agregado a los recursos de tu empleado.`);
      }
      onUploaded(data.entry);
    } catch (error) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === localId
            ? { ...i, status: "error", error: error instanceof Error ? error.message : "No pudimos subir el documento." }
            : i
        )
      );
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => void uploadFile(file));
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={DOCUMENT_LIMITS.mimeTypes.join(",")}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
        <Upload className="size-3.5" data-icon="inline-start" />
        Subir documento
      </Button>

      {items.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {DOCUMENT_MIME_LABELS[item.mimeType] ?? "Archivo"} · {formatFileSize(item.size)}
                  {item.status === "error" && item.error ? ` · ${item.error}` : ""}
                </p>
              </div>
              {item.status === "uploading" && (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              )}
              {item.status === "error" && (
                <>
                  <AlertCircle className="size-4 shrink-0 text-destructive" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}
                    aria-label={`Descartar: ${item.name}`}
                  >
                    <X className="size-3.5" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
