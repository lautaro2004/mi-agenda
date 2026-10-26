"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { requestJson } from "@/lib/api-client";
import {
  DEFAULT_LEAD_FORM,
  MAX_CUSTOM_QUESTIONS,
  MAX_QUESTION_OPTIONS,
  leadFormConfigSchema,
  newQuestionId,
  type FieldMode,
  type LeadCustomQuestion,
  type LeadFormConfig,
  type StandardLeadField,
} from "@/lib/lead-form";

const FIELD_ORDER: { key: StandardLeadField; hint: string }[] = [
  { key: "customerEmail", hint: "Si lo ocultás, solo vas a tener el WhatsApp." },
  { key: "companyName", hint: "Ej: “Nombre de tu local”, “Empresa”." },
  { key: "location", hint: "Ej: “Barrio”, “Ciudad”, “Zona de entrega”." },
  { key: "message", hint: "Texto libre al final del formulario." },
];

const MODE_LABEL: Record<FieldMode, string> = {
  required: "Obligatorio",
  optional: "Opcional",
  hidden: "Oculto",
};

// Editor del formulario de la plantilla de captación (Sitio web →
// Plantilla). Nombre y WhatsApp van siempre; el resto lo decide el negocio,
// más hasta MAX_CUSTOM_QUESTIONS preguntas propias. Valida con el mismo
// schema que el servidor antes de guardar.
export function LeadFormEditor() {
  const [saved, setSaved] = React.useState<LeadFormConfig | null>(null);
  const [draft, setDraft] = React.useState<LeadFormConfig | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    requestJson<{ config: LeadFormConfig }>("/api/business/lead-form")
      .then(({ config }) => {
        setSaved(config);
        setDraft(config);
      })
      .catch(() => toast.error("No pudimos cargar el formulario."));
  }, []);

  if (!draft || !saved) return <Skeleton className="mt-6 h-40 w-full rounded-xl" />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const isDefault = JSON.stringify(saved) === JSON.stringify(DEFAULT_LEAD_FORM);

  function setField(key: StandardLeadField, patch: Partial<LeadFormConfig["fields"][StandardLeadField]>) {
    setDraft((d) => d && { ...d, fields: { ...d.fields, [key]: { ...d.fields[key], ...patch } } });
  }

  function setQuestion(id: string, patch: Partial<LeadCustomQuestion>) {
    setDraft((d) => d && { ...d, custom: d.custom.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
  }

  function addQuestion() {
    setDraft(
      (d) =>
        d && {
          ...d,
          custom: [...d.custom, { id: newQuestionId(), label: "", type: "select", options: ["Sí", "No"], required: true }],
        }
    );
  }

  async function save() {
    if (!draft) return;
    // Limpieza de lo que se tipeó como "Sí, No, " → ["Sí", "No"]: sin
    // vacías ni repetidas. Una pregunta de texto no guarda opciones.
    const cleaned: LeadFormConfig = {
      ...draft,
      custom: draft.custom.map((q) => ({
        ...q,
        options: q.type === "select" ? [...new Set(q.options.map((o) => o.trim()).filter(Boolean))] : [],
      })),
    };
    const parsed = leadFormConfigSchema.safeParse(cleaned);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisá el formulario.");
      return;
    }
    setBusy(true);
    try {
      const { config } = await requestJson<{ config: LeadFormConfig }>("/api/business/lead-form", {
        method: "PUT",
        body: JSON.stringify(parsed.data),
      });
      setSaved(config);
      setDraft(config);
      toast.success("Formulario guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar el formulario.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!window.confirm("¿Volver al formulario estándar? Se borran tus preguntas propias.")) return;
    setBusy(true);
    try {
      const { config } = await requestJson<{ config: LeadFormConfig }>("/api/business/lead-form", { method: "DELETE" });
      setSaved(config);
      setDraft(config);
    } catch {
      toast.error("No pudimos restablecer el formulario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground">Formulario</h4>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Elegí qué le pedís a cada interesado. Nombre y WhatsApp van siempre. Cada campo extra baja un poco la
            cantidad de personas que lo completan: pedí solo lo que te sirve para calificar.
          </p>
        </div>
        {!isDefault && (
          <Button variant="ghost" size="sm" onClick={reset} disabled={busy} className="shrink-0">
            <RotateCcw className="size-3.5" data-icon="inline-start" />
            Restablecer
          </Button>
        )}
      </div>

      <div className="mt-5 divide-y divide-border rounded-xl border border-border">
        {FIELD_ORDER.map(({ key, hint }) => {
          const field = draft.fields[key];
          return (
            <div key={key} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <Input
                  aria-label="Etiqueta del campo"
                  value={field.label}
                  maxLength={60}
                  disabled={field.mode === "hidden"}
                  onChange={(e) => setField(key, { label: e.target.value })}
                  className="max-w-sm"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
              </div>
              <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label={field.label}>
                {(Object.keys(MODE_LABEL) as FieldMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={field.mode === mode}
                    onClick={() => setField(key, { mode })}
                    className={
                      field.mode === mode
                        ? "rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                        : "rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    }
                  >
                    {MODE_LABEL[mode]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <h5 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Preguntas propias ({draft.custom.length}/{MAX_CUSTOM_QUESTIONS})
          </h5>
          {draft.custom.length < MAX_CUSTOM_QUESTIONS && (
            <Button variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="size-3.5" data-icon="inline-start" />
              Agregar pregunta
            </Button>
          )}
        </div>

        {draft.custom.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
            Sumá preguntas para saber de entrada si un contacto te sirve. Por ejemplo: “¿Ya vendés por apps de
            delivery?” con las opciones Sí / No. Las respuestas llegan en cada consulta, y la calificación con IA las
            tiene en cuenta.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {draft.custom.map((q) => (
              <div key={q.id} className="rounded-xl border border-border p-4">
                <div className="flex gap-2">
                  <Input
                    aria-label="Pregunta"
                    placeholder="Ej: ¿Ya vendés por apps de delivery?"
                    value={q.label}
                    maxLength={100}
                    onChange={(e) => setQuestion(q.id, { label: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Quitar pregunta"
                    onClick={() => setDraft((d) => d && { ...d, custom: d.custom.filter((x) => x.id !== q.id) })}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <div className="inline-flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Tipo de respuesta">
                    {(["select", "text"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        role="radio"
                        aria-checked={q.type === type}
                        onClick={() =>
                          setQuestion(q.id, {
                            type,
                            options: type === "select" && q.options.length < 2 ? ["Sí", "No"] : q.options,
                          })
                        }
                        className={
                          q.type === type
                            ? "rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                            : "rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                        }
                      >
                        {type === "select" ? "Opciones" : "Texto libre"}
                      </button>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={q.required} onCheckedChange={(required) => setQuestion(q.id, { required })} />
                    Obligatoria
                  </label>
                </div>

                {q.type === "select" && (
                  <div className="mt-3">
                    <Input
                      aria-label="Opciones separadas por coma"
                      placeholder="Sí, No"
                      // Se edita como texto separado por comas; se limpia al guardar.
                      value={q.options.join(", ")}
                      onChange={(e) =>
                        setQuestion(q.id, {
                          options: e.target.value
                            .split(",")
                            .map((o) => o.trimStart())
                            .slice(0, MAX_QUESTION_OPTIONS),
                        })
                      }
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Separadas por coma, hasta {MAX_QUESTION_OPTIONS}. Con 5 o menos se muestran como botones.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {dirty && (
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setDraft(saved)} disabled={busy}>
            Cancelar
          </Button>
          <Button size="sm" onClick={save} disabled={busy}>
            {busy ? "Guardando…" : "Guardar formulario"}
          </Button>
        </div>
      )}
    </div>
  );
}
