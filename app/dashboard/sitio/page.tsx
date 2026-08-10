"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CheckCircle2, Circle, ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { requestJson } from "@/lib/api-client";
import type { SeoConfig } from "@/lib/types";

interface SeoState {
  seo: SeoConfig | null;
  slug: string;
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
