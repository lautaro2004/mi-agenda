"use client";

import * as React from "react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";
import type { SiteSummary } from "@/modules/analytics/site-events";

const nf = new Intl.NumberFormat("es-AR");
const PERIODS = [7, 30, 90] as const;

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Table({ title, rows, empty }: { title: string; rows: { label: string; views: number; inquiries: number }[]; empty: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{empty}</p>
      ) : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-1.5 font-medium">Origen</th>
              <th className="pb-1.5 text-right font-medium">Vistas</th>
              <th className="pb-1.5 text-right font-medium">Consultas</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-t border-border">
                <td className="py-1.5 pr-2 break-all text-foreground">{r.label}</td>
                <td className="py-1.5 text-right tabular-nums">{nf.format(r.views)}</td>
                <td className="py-1.5 text-right tabular-nums">{nf.format(r.inquiries)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function SiteStats() {
  const [days, setDays] = React.useState<(typeof PERIODS)[number]>(30);
  const [summary, setSummary] = React.useState<SiteSummary | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    requestJson<{ summary: SiteSummary }>(`/api/business/site-analytics?days=${days}`)
      .then(({ summary }) => setSummary(summary))
      .catch(() => toast.error("No pudimos cargar las visitas."))
      .finally(() => setLoading(false));
  }, [days]);

  const max = Math.max(1, ...(summary?.daily.map((d) => d.views) ?? [1]));

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-foreground">Visitas de tu sitio</h2>
        <div className="inline-flex rounded-lg border border-border p-0.5">
          {PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDays(p)}
              className={days === p ? "rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background" : "rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"}
            >
              {p} días
            </button>
          ))}
        </div>
      </div>

      {loading || !summary ? (
        <Skeleton className="mt-4 h-48 w-full rounded-xl" />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Vistas" value={nf.format(summary.views)} />
            <Tile label="Sesiones" value={nf.format(summary.sessions)} hint="Visitas distintas (por pestaña)" />
            <Tile label="Clics en contacto" value={nf.format(summary.ctaClicks)} hint="WhatsApp y botones de contacto" />
            <Tile label="Consultas web" value={nf.format(summary.inquiries)} />
            <Tile label="Conversión" value={summary.conversionPct === null ? "—" : `${summary.conversionPct}%`} hint="Consultas / sesiones" />
          </div>

          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold text-foreground">Vistas por día</h3>
            {summary.daily.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Todavía no hay visitas registradas. Se cuentan desde que se publica esta versión; abrí tu sitio para probar.
              </p>
            ) : (
              <div className="mt-3 flex h-28 items-end gap-1" role="img" aria-label="Vistas por día">
                {summary.daily.map((d) => (
                  <div key={d.date} className="group relative flex-1" title={`${d.date}: ${d.views}`}>
                    <div className="w-full rounded-t bg-primary/70" style={{ height: `${Math.max(4, (d.views / max) * 100)}%` }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <Table title="De dónde entran" rows={summary.sources} empty="Sin datos todavía." />
            <Table title="Campañas (utm_campaign)" rows={summary.campaigns} empty="Agregá utm_campaign a tus links para verlas acá." />
          </div>

          {summary.topPages.length > 0 && (
            <div className="mt-4 rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold text-foreground">Páginas más vistas</h3>
              <ul className="mt-2 divide-y divide-border text-sm">
                {summary.topPages.map((p) => (
                  <li key={p.path} className="flex justify-between gap-3 py-1.5">
                    <span className="break-all">{p.path}</span>
                    <span className="tabular-nums text-muted-foreground">{nf.format(p.views)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
