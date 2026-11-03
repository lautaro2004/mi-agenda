"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestJson } from "@/lib/api-client";
import { normalizeSlug } from "@/lib/slug";

// Cambio de la URL pública. Avisa que el link anterior sigue funcionando
// (redirige al nuevo) pero que hay que actualizar lo ya impreso o publicado.
export function SlugEditor({ slug, onChanged }: { slug: string; onChanged: (slug: string) => void }) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(slug);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const normalized = normalizeSlug(value);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await requestJson<{ slug: string }>("/api/business/slug", {
        method: "PATCH",
        body: JSON.stringify({ slug: normalized }),
      });
      onChanged(res.slug);
      setEditing(false);
      toast.success("URL actualizada. El link anterior redirige al nuevo.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cambiar la URL.");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-sm text-foreground">/s/{slug}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setValue(slug); setError(null); setEditing(true); }}>
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-sm text-muted-foreground">/s/</span>
        <Input aria-label="Nueva URL" value={value} maxLength={50} onChange={(e) => setValue(e.target.value)} className="font-mono" />
      </div>
      {normalized && normalized !== value && <p className="mt-1 text-xs text-muted-foreground">Quedará como: /s/{normalized}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
      <p className="mt-2 text-xs text-muted-foreground">
        El link actual va a seguir funcionando: redirige al nuevo. Igual conviene actualizar lo que ya publicaste o
        imprimiste (bio de Instagram, anuncios, QR) para no depender de la redirección.
      </p>
      <div className="mt-2 flex gap-2">
        <Button type="button" size="sm" disabled={busy || !normalized || normalized === slug} onClick={save}>
          {busy ? "Guardando…" : "Guardar URL"}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setEditing(false)}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
