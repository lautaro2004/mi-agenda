"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Circle, ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { AssetUploader } from "@/components/dashboard/asset-uploader";
import { requestJson } from "@/lib/api-client";
import { ASSET_LIMITS } from "@/lib/asset-limits";
import { HEX_COLOR_RE } from "@/lib/brand-color";
import type { Business, SeoConfig } from "@/lib/types";

interface SeoState {
  seo: SeoConfig | null;
  slug: string;
}

const FALLBACK_COLOR = "#171717";

function AppearanceSection() {
  const [business, setBusiness] = React.useState<Business | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [colorInput, setColorInput] = React.useState("");
  const [savingColor, setSavingColor] = React.useState(false);

  React.useEffect(() => {
    requestJson<{ business: Business }>("/api/business")
      .then(({ business }) => {
        setBusiness(business);
        setColorInput(business.brandColor ?? "");
      })
      .catch(() => setLoadError(true));
  }, []);

  async function saveColor(next: string | null) {
    setSavingColor(true);
    try {
      const { business: updated } = await requestJson<{ business: Business }>("/api/business", {
        method: "PATCH",
        body: JSON.stringify({ brandColor: next }),
      });
      setBusiness(updated);
      setColorInput(updated.brandColor ?? "");
      toast.success("Color de marca actualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar el color.");
    } finally {
      setSavingColor(false);
    }
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        No pudimos cargar la apariencia de tu sitio. Recargá la página para volver a intentar.
      </div>
    );
  }

  if (!business) {
    return <Skeleton className="h-80 rounded-2xl" />;
  }

  const colorIsValid = colorInput === "" || HEX_COLOR_RE.test(colorInput);
  const colorChanged = (business.brandColor ?? "") !== colorInput;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-sm font-semibold text-foreground">Apariencia</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Una personalización mínima para que el sitio se sienta tuyo — la plantilla y el resto del diseño los define
        Mi Agenda.
      </p>

      <div className="mt-6 space-y-6 border-t border-border pt-6">
        <div>
          <p className="text-sm font-medium text-foreground">Logo</p>
          <p className="mt-1 text-xs text-muted-foreground">El logo aparece en el encabezado y el pie del sitio.</p>
          <div className="mt-3">
            <AssetUploader
              kind="logo"
              value={business.logoUrl}
              onChange={(url) => setBusiness((prev) => (prev ? { ...prev, logoUrl: url } : prev))}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            PNG, JPG o WebP · máximo {ASSET_LIMITS.logo.maxBytes / (1024 * 1024)} MB
          </p>
        </div>

        <div className="border-t border-border pt-6">
          <p className="text-sm font-medium text-foreground">Imagen del encabezado</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Se usa para personalizar el hero de tu sitio. Recomendado: imágenes horizontales y livianas.
          </p>
          <div className="mt-3">
            <AssetUploader
              kind="hero"
              shape="wide"
              value={business.heroImageUrl}
              onChange={(url) => setBusiness((prev) => (prev ? { ...prev, heroImageUrl: url } : prev))}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            JPG o WebP · máximo {ASSET_LIMITS.hero.maxBytes / (1024 * 1024)} MB
          </p>
        </div>

        <div className="border-t border-border pt-6">
          <p className="text-sm font-medium text-foreground">Color de marca</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Se usa como acento en botones y detalles del sitio. Si no elegís uno, usamos un color neutro por defecto.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(colorInput) ? colorInput : FALLBACK_COLOR}
              onChange={(e) => setColorInput(e.target.value)}
              className="size-9 cursor-pointer rounded-lg border border-border bg-transparent p-0.5"
              aria-label="Elegir color de marca"
            />
            <input
              type="text"
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
              placeholder="#171717"
              className="h-9 w-28 rounded-lg border border-border bg-background px-2.5 text-sm text-foreground"
              aria-invalid={!colorIsValid}
            />
            <Button
              type="button"
              size="sm"
              disabled={!colorIsValid || !colorChanged || savingColor}
              onClick={() => void saveColor(colorInput || null)}
            >
              {savingColor && <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />}
              Guardar
            </Button>
            {business.brandColor && (
              <Button type="button" variant="ghost" size="sm" disabled={savingColor} onClick={() => void saveColor(null)}>
                Quitar
              </Button>
            )}
          </div>
          {!colorIsValid && <p className="mt-1.5 text-xs text-destructive">Ingresá un color hexadecimal válido.</p>}
        </div>
      </div>
    </div>
  );
}

export default function SitioPage() {
  const [state, setState] = React.useState<SeoState | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  const load = React.useCallback(() => {
    setLoadError(false);
    requestJson<SeoState>("/api/business/seo")
      .then(setState)
      .catch(() => setLoadError(true));
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function regenerate() {
    setGenerating(true);
    try {
      const { seo } = await requestJson<{ seo: SeoConfig }>("/api/business/seo/generate", { method: "POST" });
      // Reemplaza solo si funcionó — si falla, el catch no toca "state" y la
      // config anterior (la que ya está publicada en el sitio) queda intacta.
      setState((prev) => (prev ? { ...prev, seo } : prev));
      toast.success("SEO actualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar el SEO. Probá de nuevo.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sitio web"
        description="Tu negocio tiene una página pública automática, con SEO generado a partir de tu configuración real."
      />

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          No pudimos cargar el estado del sitio. Recargá la página para volver a intentar.
        </div>
      ) : !state ? (
        <div className="space-y-4">
          <Skeleton className="h-16 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Tu sitio público</p>
              <p className="mt-1 font-mono text-sm text-foreground">/s/{state.slug}</p>
            </div>
            <Button variant="outline" render={<Link href={`/s/${state.slug}`} target="_blank" />} nativeButton={false}>
              Ver sitio público
              <ExternalLink className="ml-1.5 size-3.5" data-icon="inline-end" />
            </Button>
          </div>

          <AppearanceSection />

          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                {state.seo ? (
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {state.seo ? "SEO configurado" : "SEO todavía no generado"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {state.seo
                      ? "Se generó automáticamente a partir de tu negocio, servicios y preguntas frecuentes."
                      : "Se genera solo cuando termines de configurar tu negocio, o podés forzarlo ahora."}
                  </p>
                </div>
              </div>
              <Button type="button" size="sm" onClick={() => void regenerate()} disabled={generating}>
                {generating ? (
                  <Loader2 className="size-3.5 animate-spin" data-icon="inline-start" />
                ) : (
                  <RefreshCw className="size-3.5" data-icon="inline-start" />
                )}
                Actualizar SEO
              </Button>
            </div>

            {state.seo && (
              <div className="mt-6 space-y-4 border-t border-border pt-5">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Título</p>
                  <p className="mt-1 text-sm text-foreground">{state.seo.seoTitle}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Descripción</p>
                  <p className="mt-1 text-sm text-foreground">{state.seo.metaDescription}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Keywords / temas</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {state.seo.keywords.map((keyword) => (
                      <Badge key={keyword} variant="outline">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
