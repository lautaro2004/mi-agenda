"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Check, Copy, Download, ExternalLink, FileText, Loader2, ScrollText, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/dashboard/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";
import { useOnboarding } from "@/lib/onboarding-store";
import { ASSET_LIMITS } from "@/lib/asset-limits";

interface MenuState {
  menuEnabled: boolean;
  menuPdfUrl: string | null;
}

interface QrData {
  url: string;
  pngDataUrl: string;
  svg: string;
}

const limits = ASSET_LIMITS.menu;

function fileNameFromUrl(url: string): string {
  try {
    return decodeURIComponent(url.split("/").pop() ?? "carta.pdf");
  } catch {
    return "carta.pdf";
  }
}

export default function MenuPage() {
  const { state: onboardingState } = useOnboarding();
  const slug = onboardingState.business.slug;

  const [menu, setMenu] = React.useState<MenuState | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const [removing, setRemoving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(() => {
    setLoadError(false);
    requestJson<{ menu: MenuState }>("/api/business/menu")
      .then(({ menu }) => setMenu(menu))
      .catch(() => setLoadError(true));
  }, []);

  React.useEffect(load, [load]);

  async function handleFile(file: File | undefined) {
    if (!file) return;

    if (!limits.mimeTypes.includes(file.type)) {
      toast.error("Solo se acepta un archivo PDF.");
      return;
    }
    if (file.size > limits.maxBytes) {
      toast.error(`El archivo supera el máximo de ${Math.round(limits.maxBytes / (1024 * 1024))} MB.`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/business/menu/pdf", { method: "POST", body: formData });
      const data = (await res.json().catch(() => null)) as { menu?: MenuState; error?: string } | null;
      if (!res.ok || !data?.menu) throw new Error(data?.error ?? "No pudimos subir la carta.");
      setMenu(data.menu);
      toast.success("Carta actualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos subir la carta.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!confirm("¿Eliminar la carta actual?")) return;
    setRemoving(true);
    try {
      const { menu: updated } = await requestJson<{ menu: MenuState }>("/api/business/menu/pdf", { method: "DELETE" });
      setMenu(updated);
      toast.success("Carta eliminada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos eliminar la carta.");
    } finally {
      setRemoving(false);
    }
  }

  async function handleToggle(enabled: boolean) {
    setToggling(true);
    try {
      const { menu: updated } = await requestJson<{ menu: MenuState }>("/api/business/menu", {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      });
      setMenu(updated);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar la carta.");
    } finally {
      setToggling(false);
    }
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="Carta digital" description="Subí tu carta y compartila mediante un QR." />
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          No pudimos cargar la carta digital. Recargá la página para volver a intentar.
        </div>
      </div>
    );
  }

  if (!menu) {
    return (
      <div>
        <PageHeader title="Carta digital" description="Subí tu carta y compartila mediante un QR." />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const isReady = menu.menuEnabled && menu.menuPdfUrl && slug;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Carta digital" description="Subí tu carta y compartila mediante un QR." />

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span
              className={
                menu.menuEnabled
                  ? "size-2.5 shrink-0 rounded-full bg-emerald-500"
                  : "size-2.5 shrink-0 rounded-full bg-muted-foreground/40"
              }
            />
            <p className="text-sm font-medium text-foreground">
              {menu.menuEnabled ? "Carta activa" : "Carta desactivada"}
            </p>
          </div>
          <Switch checked={menu.menuEnabled} disabled={toggling} onCheckedChange={(checked) => void handleToggle(checked)} />
        </div>

        <div className="mt-6 border-t border-border pt-6">
          <p className="text-sm font-medium text-foreground">PDF cargado</p>
          {menu.menuPdfUrl ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-3">
              <a
                href={menu.menuPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground hover:bg-muted"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span className="max-w-48 truncate">{fileNameFromUrl(menu.menuPdfUrl)}</span>
                <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
              </a>
              <Button size="sm" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
                {uploading ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : null}
                Reemplazar PDF
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground" disabled={removing} onClick={() => void handleRemove()}>
                {removing ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : <X className="size-3.5" data-icon="inline-start" />}
                Quitar
              </Button>
            </div>
          ) : (
            <div className="mt-2.5">
              <Button size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
                {uploading ? <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" /> : <Upload className="size-3.5" data-icon="inline-start" />}
                Subir carta (PDF)
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">PDF · máximo {Math.round(limits.maxBytes / (1024 * 1024))} MB</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={limits.mimeTypes.join(",")}
            className="hidden"
            disabled={uploading}
            onChange={(e) => void handleFile(e.target.files?.[0])}
          />
        </div>
      </div>

      {!slug && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-foreground">
          Tu sitio todavía no tiene una URL pública generada — completá la configuración de tu negocio para poder
          publicar la carta.
        </div>
      )}

      {isReady && <MenuQrCard slug={slug!} />}

      {menu.menuPdfUrl && menu.menuEnabled === false && (
        <p className="text-xs text-muted-foreground">
          Tenés una carta cargada pero está desactivada — no es visible en tu sitio ni tiene URL pública hasta que la
          actives.
        </p>
      )}
    </div>
  );
}

function MenuQrCard({ slug }: { slug: string }) {
  const [qr, setQr] = React.useState<QrData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    requestJson<QrData>("/api/business/menu/qr")
      .then(setQr)
      .catch(() => setQr(null))
      .finally(() => setLoading(false));
  }, [slug]);

  async function copyLink() {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(qr.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No pudimos copiar el enlace.");
    }
  }

  function downloadPng() {
    if (!qr) return;
    const a = document.createElement("a");
    a.href = qr.pngDataUrl;
    a.download = "carta-qr.png";
    a.click();
  }

  function downloadSvg() {
    if (!qr) return;
    const blob = new Blob([qr.svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "carta-qr.svg";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-foreground">QR de tu carta</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Imprimilo en tus mesas o compartilo — siempre apunta a la última versión de tu carta, aunque reemplaces el
        PDF.
      </p>

      {loading ? (
        <Skeleton className="mt-4 h-40 w-40 rounded-xl" />
      ) : !qr ? (
        <p className="mt-4 text-sm text-destructive">No pudimos generar el QR.</p>
      ) : (
        <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr.pngDataUrl} alt="QR de la carta" className="size-40 rounded-xl border border-border" />
          <div className="flex flex-1 flex-col gap-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <ScrollText className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-foreground">{qr.url}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={copyLink}>
                {copied ? <Check className="size-3.5" data-icon="inline-start" /> : <Copy className="size-3.5" data-icon="inline-start" />}
                {copied ? "Copiado" : "Copiar enlace"}
              </Button>
              <Button size="sm" variant="outline" onClick={downloadPng}>
                <Download className="size-3.5" data-icon="inline-start" />
                PNG
              </Button>
              <Button size="sm" variant="outline" onClick={downloadSvg}>
                <Download className="size-3.5" data-icon="inline-start" />
                SVG
              </Button>
              <Button size="sm" variant="ghost" render={<Link href={qr.url} target="_blank" />} nativeButton={false}>
                <ExternalLink className="size-3.5" data-icon="inline-start" />
                Ver carta
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
