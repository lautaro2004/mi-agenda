"use client";

import * as React from "react";
import { toast } from "sonner";
import { RotateCcw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";
import { LEADS_DEFAULT_COPY } from "@/lib/landing-copy";
import type { LandingCopyValues } from "@/lib/schemas";

interface LandingCopyState {
  copy: LandingCopyValues | null;
  generatedAt: string | null;
}

const EMPTY_DRAFT: LandingCopyValues = { ...LEADS_DEFAULT_COPY, heroTitle: "", heroSubtitle: "" };

// Editor de los textos de la plantilla de captación (Sitio web → Plantilla).
// La IA propone; el dueño revisa, corrige y guarda. Sin textos guardados, el
// sitio usa los fijos (título = H1 del SEO, subtítulo = descripción).
export function LandingCopyEditor() {
  const [state, setState] = React.useState<LandingCopyState | null>(null);
  const [draft, setDraft] = React.useState<LandingCopyValues | null>(null);
  const [busy, setBusy] = React.useState<"generate" | "save" | "reset" | null>(null);

  React.useEffect(() => {
    requestJson<LandingCopyState>("/api/business/landing-copy")
      .then((s) => {
        setState(s);
        setDraft(s.copy);
      })
      .catch(() => toast.error("No pudimos cargar los textos de la página."));
  }, []);

  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(state?.copy ?? null);

  async function generate() {
    if (dirty && !window.confirm("Tenés cambios sin guardar. ¿Reemplazarlos por textos nuevos generados con IA?")) return;
    setBusy("generate");
    try {
      const next = await requestJson<LandingCopyState>("/api/business/landing-copy/generate", { method: "POST" });
      setState(next);
      setDraft(next.copy);
      toast.success("Textos generados. Revisalos y ajustá lo que quieras.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos generar los textos.");
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!draft) return;
    setBusy("save");
    try {
      const next = await requestJson<LandingCopyState>("/api/business/landing-copy", {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      setState(next);
      setDraft(next.copy);
      toast.success("Textos guardados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar los textos.");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!window.confirm("¿Volver a los textos estándar? Se borran los textos personalizados.")) return;
    setBusy("reset");
    try {
      const next = await requestJson<LandingCopyState>("/api/business/landing-copy", { method: "DELETE" });
      setState(next);
      setDraft(null);
      toast.success("La página volvió a los textos estándar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos restablecer los textos.");
    } finally {
      setBusy(null);
    }
  }

  if (state === null) return <Skeleton className="mt-6 h-32 rounded-xl" />;

  const set = <K extends keyof LandingCopyValues>(key: K, value: LandingCopyValues[K]) =>
    setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Textos de la página</h4>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            {state.copy
              ? state.generatedAt
                ? `Generados con IA el ${new Date(state.generatedAt).toLocaleDateString("es-AR")} a partir de tu negocio y tus servicios. Podés editarlos.`
                : "Textos personalizados."
              : "Hoy se ven los textos estándar. Generalos con IA para que hablen de tu rubro, o escribilos vos."}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {state.copy && (
            <Button variant="ghost" size="sm" onClick={reset} disabled={busy !== null}>
              <RotateCcw className="size-3.5" data-icon="inline-start" />
              Restablecer
            </Button>
          )}
          {!state.copy && !draft && (
            <Button variant="outline" size="sm" onClick={() => setDraft(EMPTY_DRAFT)} disabled={busy !== null}>
              Escribirlos yo
            </Button>
          )}
          <Button size="sm" onClick={generate} disabled={busy !== null}>
            <Sparkles className="size-3.5" data-icon="inline-start" />
            {busy === "generate" ? "Generando…" : state.copy ? "Regenerar con IA" : "Generar con IA"}
          </Button>
        </div>
      </div>

      {draft && (
        <div className="mt-5 space-y-6">
          <Group title="Portada">
            <TextField label="Título" value={draft.heroTitle} max={80} onChange={(v) => set("heroTitle", v)} />
            <TextField label="Bajada" value={draft.heroSubtitle} max={240} multiline onChange={(v) => set("heroSubtitle", v)} />
            <TextField label="Botón principal" value={draft.ctaLabel} max={32} onChange={(v) => set("ctaLabel", v)} />
          </Group>

          <Group title="Cómo funciona">
            {draft.steps.map((step, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                <TextField
                  label={`Paso ${i + 1}`}
                  value={step.title}
                  max={40}
                  onChange={(v) => set("steps", draft.steps.map((s, j) => (j === i ? { ...s, title: v } : s)))}
                />
                <TextField
                  label="Detalle"
                  value={step.body}
                  max={120}
                  onChange={(v) => set("steps", draft.steps.map((s, j) => (j === i ? { ...s, body: v } : s)))}
                />
              </div>
            ))}
          </Group>

          <Group title="Servicios">
            <TextField label="Título" value={draft.servicesTitle} max={50} onChange={(v) => set("servicesTitle", v)} />
            <TextField
              label="Texto de apoyo (opcional)"
              value={draft.servicesIntro}
              max={200}
              multiline
              onChange={(v) => set("servicesIntro", v)}
            />
          </Group>

          <Group title="Cierre y formulario">
            <TextField label="Título del cierre" value={draft.closingTitle} max={50} onChange={(v) => set("closingTitle", v)} />
            <TextField label="Texto del cierre" value={draft.closingBody} max={180} multiline onChange={(v) => set("closingBody", v)} />
            <div className="grid gap-2 sm:grid-cols-3">
              {draft.reasons.map((reason, i) => (
                <TextField
                  key={i}
                  label={`Motivo ${i + 1}`}
                  value={reason}
                  max={50}
                  onChange={(v) => set("reasons", draft.reasons.map((r, j) => (j === i ? v : r)))}
                />
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <TextField label="Título del formulario" value={draft.formTitle} max={40} onChange={(v) => set("formTitle", v)} />
              <TextField
                label="Bajada del formulario (opcional)"
                value={draft.formSubtitle}
                max={80}
                onChange={(v) => set("formSubtitle", v)}
              />
            </div>
          </Group>

          {dirty && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDraft(state.copy)} disabled={busy !== null}>
                Descartar cambios
              </Button>
              <Button size="sm" onClick={save} disabled={busy !== null}>
                {busy === "save" ? "Guardando…" : "Guardar textos"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-xs font-medium text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

function TextField({
  label,
  value,
  max,
  multiline,
  onChange,
}: {
  label: string;
  value: string;
  max: number;
  multiline?: boolean;
  onChange: (value: string) => void;
}) {
  const id = React.useId();
  const over = value.length > max;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm text-foreground">
          {label}
        </label>
        <span className={over ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {value.length}/{max}
        </span>
      </div>
      {multiline ? (
        <Textarea id={id} rows={2} className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input id={id} className="mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
