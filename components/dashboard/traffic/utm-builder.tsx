"use client";

import * as React from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UTM_KEYS, buildUtmUrl, type UtmKey } from "@/lib/site-tracking";

type Utm = Partial<Record<UtmKey, string>>;
interface LinkRow {
  id: string;
  label: string;
  url: string;
  // Valores propios de este enlace (pisan a los generales).
  override: Utm;
}

const PRESETS: { label: string; utm: Utm }[] = [
  { label: "Instagram (bio / historias)", utm: { utm_source: "instagram", utm_medium: "social" } },
  { label: "Instagram Ads", utm: { utm_source: "instagram", utm_medium: "paid_social" } },
  { label: "Facebook / Meta Ads", utm: { utm_source: "facebook", utm_medium: "paid_social" } },
  { label: "Google Ads", utm: { utm_source: "google", utm_medium: "cpc" } },
  { label: "WhatsApp", utm: { utm_source: "whatsapp", utm_medium: "social" } },
  { label: "Email", utm: { utm_source: "email", utm_medium: "email" } },
];

const FIELD_LABEL: Record<UtmKey, { label: string; hint: string }> = {
  utm_source: { label: "Origen (utm_source)", hint: "Dónde está el link: instagram, facebook, google…" },
  utm_medium: { label: "Medio (utm_medium)", hint: "Tipo de tráfico: social, paid_social, cpc, email…" },
  utm_campaign: { label: "Campaña (utm_campaign)", hint: "Nombre de la campaña: promo_noviembre" },
  utm_content: { label: "Contenido (utm_content)", hint: "Para distinguir anuncios o botones: video_1" },
  utm_term: { label: "Término (utm_term)", hint: "Palabra clave (anuncios de búsqueda)" },
};

let counter = 0;
const newId = () => `l${++counter}`;

export function UtmBuilder({ slug }: { slug: string | null }) {
  const [origin, setOrigin] = React.useState("");
  const [shared, setShared] = React.useState<Utm>({ utm_source: "instagram", utm_medium: "social" });
  const [rows, setRows] = React.useState<LinkRow[]>([]);

  React.useEffect(() => {
    const o = window.location.origin;
    setOrigin(o);
    if (slug) {
      setRows([
        { id: newId(), label: "Sitio principal", url: `${o}/s/${slug}`, override: {} },
        { id: newId(), label: "Reservar", url: `${o}/s/${slug}/reservar`, override: {} },
        { id: newId(), label: "Carta", url: `${o}/s/${slug}/carta`, override: {} },
      ]);
    }
  }, [slug]);

  const generated = rows.map((row) => {
    const merged: Utm = { ...shared };
    for (const key of UTM_KEYS) if (row.override[key]?.trim()) merged[key] = row.override[key];
    return { row, ...buildUtmUrl(row.url, merged) };
  });

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copiado.");
    } catch {
      toast.error("No pudimos copiar. Seleccionalo y copialo a mano.");
    }
  }

  function setRow(id: string, patch: Partial<LinkRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const valid = generated.filter((g) => g.url);

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-base font-semibold text-foreground">Links con UTM</h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Agregá estos parámetros a tus links y vas a ver desde dónde entra cada visita y cada consulta. Cargá los valores
        una vez y se aplican a todos los enlaces; si un enlace necesita otro valor, cambialo en esa fila.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p.label} type="button" size="sm" variant="outline" onClick={() => setShared((s) => ({ ...s, ...p.utm }))}>
            {p.label}
          </Button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {UTM_KEYS.map((key) => (
          <div key={key}>
            <label className="text-xs font-medium text-foreground" htmlFor={`utm-${key}`}>
              {FIELD_LABEL[key].label}
            </label>
            <Input
              id={`utm-${key}`}
              className="mt-1.5"
              maxLength={80}
              value={shared[key] ?? ""}
              onChange={(e) => setShared((s) => ({ ...s, [key]: e.target.value }))}
            />
            <p className="mt-1 text-xs text-muted-foreground">{FIELD_LABEL[key].hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">Tus enlaces</h3>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" disabled={valid.length === 0} onClick={() => copy(valid.map((g) => `${g.row.label}: ${g.url}`).join("\n"))}>
            <Copy className="size-3.5" data-icon="inline-start" />
            Copiar todos
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setRows((rs) => [...rs, { id: newId(), label: "Otro enlace", url: origin, override: {} }])}
          >
            <Plus className="size-3.5" data-icon="inline-start" />
            Agregar enlace
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-3">
        {generated.map(({ row, url, error }) => (
          <div key={row.id} className="rounded-xl border border-border p-3">
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
              <Input aria-label="Nombre del enlace" value={row.label} maxLength={40} onChange={(e) => setRow(row.id, { label: e.target.value })} />
              <Input aria-label="URL base" value={row.url} onChange={(e) => setRow(row.id, { url: e.target.value })} />
              <Button type="button" variant="ghost" size="icon" aria-label="Quitar enlace" onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {(["utm_source", "utm_campaign", "utm_content"] as const).map((key) => (
                <Input
                  key={key}
                  aria-label={`${key} solo para este enlace`}
                  placeholder={`${key} (solo este enlace)`}
                  maxLength={80}
                  value={row.override[key] ?? ""}
                  onChange={(e) => setRow(row.id, { override: { ...row.override, [key]: e.target.value } })}
                />
              ))}
            </div>
            {url ? (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted/60 p-2.5">
                <code className="min-w-0 flex-1 text-xs break-all text-foreground">{url}</code>
                <Button type="button" size="sm" variant="outline" onClick={() => copy(url)}>
                  <Copy className="size-3.5" data-icon="inline-start" />
                  Copiar
                </Button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-destructive">{error}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
