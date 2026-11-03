"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requestJson } from "@/lib/api-client";
import { EMPTY_TRACKING, extractTrackingIds, trackingConfigSchema, type TrackingConfig } from "@/lib/site-tracking";

export function TrackingSettings() {
  const [saved, setSaved] = React.useState<TrackingConfig | null>(null);
  const [draft, setDraft] = React.useState<TrackingConfig>(EMPTY_TRACKING);
  const [paste, setPaste] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  // Resultado de la última detección: visible en pantalla (no solo un aviso que se va).
  const [detected, setDetected] = React.useState<{ ok: boolean; text: string } | null>(null);

  React.useEffect(() => {
    requestJson<{ config: TrackingConfig }>("/api/business/site-tracking")
      .then(({ config }) => {
        setSaved(config);
        setDraft(config);
      })
      .catch(() => toast.error("No pudimos cargar la configuración."));
  }, []);

  function detect(text: string) {
    setPaste(text);
    if (!text.trim()) {
      setDetected(null);
      return;
    }
    const ids = extractTrackingIds(text);
    const found = [
      ids.metaPixelId && `píxel de Meta (${ids.metaPixelId})`,
      ids.gtmId && `GTM (${ids.gtmId})`,
      ids.ga4Id && `GA4 (${ids.ga4Id})`,
    ].filter(Boolean);
    if (found.length === 0) {
      setDetected({ ok: false, text: "No encontramos ningún ID en ese texto. Cargalo a mano en los campos de abajo." });
      return;
    }
    setDetected({ ok: true, text: `Detectamos: ${found.join(", ")}. Apretá “Guardar” para aplicarlo.` });
    setDraft((d) => ({
      gtmId: ids.gtmId ?? d.gtmId,
      metaPixelId: ids.metaPixelId ?? d.metaPixelId,
      ga4Id: ids.ga4Id ?? d.ga4Id,
    }));
  }

  async function save() {
    const parsed = trackingConfigSchema.safeParse({
      gtmId: draft.gtmId ?? "",
      metaPixelId: draft.metaPixelId ?? "",
      ga4Id: draft.ga4Id ?? "",
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisá los IDs.");
      return;
    }
    setBusy(true);
    try {
      const { config } = await requestJson<{ config: TrackingConfig }>("/api/business/site-tracking", {
        method: "PUT",
        body: JSON.stringify(parsed.data),
      });
      setSaved(config);
      setDraft(config);
      setPaste("");
      setDetected(null);
      toast.success("Seguimiento guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar.");
    } finally {
      setBusy(false);
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (key: keyof TrackingConfig) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value.trim() === "" ? null : e.target.value.trim() }));

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-base font-semibold text-foreground">Píxeles y etiquetas</h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Conectá el píxel de Meta, Google Tag Manager o Google Analytics 4 en tu sitio. Podés pegar el código que te da la
        plataforma y detectamos el ID, o cargar el ID a mano.
      </p>

      <div className="mt-4">
        <label className="text-xs font-medium text-foreground" htmlFor="paste-code">
          Pegar código (opcional)
        </label>
        <Textarea
          id="paste-code"
          className="mt-1.5 min-h-24 font-mono text-xs"
          placeholder="Pegá acá el código completo del píxel o de GTM…"
          value={paste}
          onChange={(e) => detect(e.target.value)}
        />
        {detected && (
          <p className={detected.ok ? "mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400" : "mt-1.5 text-xs font-medium text-destructive"}>
            {detected.text}
          </p>
        )}
        <p className="mt-1.5 text-xs text-muted-foreground">
          Solo leemos el ID. El código que pegues no se guarda ni se ejecuta: el sitio usa siempre el snippet estándar de
          cada plataforma con tu ID.
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-foreground" htmlFor="tk-meta">Píxel de Meta (ID)</label>
          <Input id="tk-meta" className="mt-1.5" placeholder="1234567890123456" value={draft.metaPixelId ?? ""} onChange={set("metaPixelId")} />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground" htmlFor="tk-gtm">Google Tag Manager (ID)</label>
          <Input id="tk-gtm" className="mt-1.5" placeholder="GTM-XXXXXXX" value={draft.gtmId ?? ""} onChange={set("gtmId")} />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground" htmlFor="tk-ga4">Google Analytics 4 (ID)</label>
          <Input id="tk-ga4" className="mt-1.5" placeholder="G-XXXXXXXXXX" value={draft.ga4Id ?? ""} onChange={set("ga4Id")} />
        </div>
      </div>

      <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>Se cargan solo si la persona acepta el aviso de cookies que mostramos en tu sitio.</li>
        <li>Al enviarse el formulario se avisa una conversión “Lead” (sin datos de la persona).</li>
        <li>Si usás GTM, configurá GA4 dentro de GTM: así no se cuenta doble.</li>
        <li>Si el píxel de Meta ya está dentro de GTM, no lo cargues también acá.</li>
      </ul>

      <div className="mt-4 flex items-center justify-end gap-2">
        {dirty && (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              setDraft(saved ?? EMPTY_TRACKING);
              setPaste("");
              setDetected(null);
            }}
          >
            Cancelar
          </Button>
        )}
        <Button size="sm" disabled={busy || !dirty} onClick={save}>
          {busy ? "Guardando…" : dirty ? "Guardar" : "Guardado"}
        </Button>
      </div>
    </section>
  );
}
