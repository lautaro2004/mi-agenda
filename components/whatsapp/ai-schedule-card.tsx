"use client";

import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { requestJson } from "@/lib/api-client";
import { DEFAULT_AI_SCHEDULE, aiScheduleSchema, type AiSchedule } from "@/lib/ai-schedule";
import { WEEK_DAYS } from "@/lib/types";

const MODES: { value: AiSchedule["mode"]; title: string; text: string }[] = [
  { value: "always", title: "Siempre", text: "La IA responde a cualquier hora." },
  {
    value: "outside_hours",
    title: "Solo fuera de mi horario laboral",
    text: "Dentro de tu horario atendés vos o tu equipo; fuera de él responde la IA.",
  },
];

export function AiScheduleCard({ aiEnabled }: { aiEnabled: boolean }) {
  const [saved, setSaved] = React.useState<AiSchedule | null>(null);
  const [draft, setDraft] = React.useState<AiSchedule>(DEFAULT_AI_SCHEDULE);
  const [tz, setTz] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    requestJson<{ schedule: AiSchedule; timeZone: string }>("/api/whatsapp/ai-schedule")
      .then(({ schedule, timeZone }) => {
        setSaved(schedule);
        setDraft(schedule);
        setTz(timeZone);
      })
      .catch(() => toast.error("No pudimos cargar el horario de la IA."));
  }, []);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  async function save() {
    const parsed = aiScheduleSchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Revisá los horarios.");
      return;
    }
    setBusy(true);
    try {
      const { schedule } = await requestJson<{ schedule: AiSchedule }>("/api/whatsapp/ai-schedule", {
        method: "PUT",
        body: JSON.stringify(parsed.data),
      });
      setSaved(schedule);
      setDraft(schedule);
      toast.success("Horario guardado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar el horario.");
    } finally {
      setBusy(false);
    }
  }

  function setDay(day: string, patch: Partial<AiSchedule["days"][number]>) {
    setDraft((d) => ({ ...d, days: d.days.map((x) => (x.day === day ? { ...x, ...patch } : x)) }));
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Horario de la IA</h3>
      <p className="mt-1 text-sm text-muted-foreground">Elegí cuándo responde la IA. Las conversaciones fuera de turno quedan para tu equipo.</p>

      <div className="mt-3 space-y-2" role="radiogroup" aria-label="Cuándo responde la IA">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={draft.mode === m.value}
            onClick={() => setDraft((d) => ({ ...d, mode: m.value }))}
            className={
              draft.mode === m.value
                ? "w-full rounded-xl border border-primary bg-primary/5 p-3 text-left"
                : "w-full rounded-xl border border-border p-3 text-left hover:border-primary/40"
            }
          >
            <p className="text-sm font-medium text-foreground">{m.title}</p>
            <p className="text-xs text-muted-foreground">{m.text}</p>
          </button>
        ))}
      </div>

      {draft.mode === "outside_hours" && (
        <div className="mt-4">
          <p className="text-xs font-medium text-foreground">Tu horario laboral (atendés vos)</p>
          <div className="mt-2 space-y-1.5">
            {WEEK_DAYS.map(({ id, label }) => {
              const d = draft.days.find((x) => x.day === id)!;
              return (
                <div key={id} className="flex flex-wrap items-center gap-2">
                  <label className="flex w-28 items-center gap-2 text-sm text-foreground">
                    <Switch checked={d.enabled} onCheckedChange={(enabled) => setDay(id, { enabled })} aria-label={`Atiendo el ${label}`} />
                    {label}
                  </label>
                  {d.enabled ? (
                    <>
                      <Input type="time" className="w-28" value={d.start} onChange={(e) => setDay(id, { start: e.target.value })} aria-label={`${label}: desde`} />
                      <span className="text-xs text-muted-foreground">a</span>
                      <Input type="time" className="w-28" value={d.end} onChange={(e) => setDay(id, { end: e.target.value })} aria-label={`${label}: hasta`} />
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Todo el día responde la IA</span>
                  )}
                </div>
              );
            })}
          </div>
          {tz && <p className="mt-2 text-xs text-muted-foreground">Zona horaria: {tz} (se cambia en Negocio).</p>}
        </div>
      )}

      {!aiEnabled && (
        <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Las respuestas automáticas están apagadas (modo manual): mientras tanto la IA no responde nunca, con o sin horario.
        </p>
      )}

      {dirty && (
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setDraft(saved ?? DEFAULT_AI_SCHEDULE)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={busy} onClick={save}>
            {busy ? "Guardando…" : "Guardar horario"}
          </Button>
        </div>
      )}
    </div>
  );
}
