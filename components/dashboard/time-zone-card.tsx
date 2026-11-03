"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requestJson } from "@/lib/api-client";
import { DEFAULT_TIME_ZONE, TIME_ZONE_OPTIONS, todayInZone } from "@/lib/time-zone";

function nowLabel(tz: string): string {
  try {
    return new Intl.DateTimeFormat("es-AR", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  } catch {
    return todayInZone(tz);
  }
}

export function TimeZoneCard() {
  const [saved, setSaved] = React.useState<string | null>(null);
  const [value, setValue] = React.useState<string>(DEFAULT_TIME_ZONE);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    requestJson<{ timeZone: string }>("/api/business/time-zone")
      .then(({ timeZone }) => {
        setSaved(timeZone);
        setValue(timeZone);
      })
      .catch(() => toast.error("No pudimos cargar la zona horaria."));
  }, []);

  const options = React.useMemo(
    () => (TIME_ZONE_OPTIONS.some((o) => o.value === value) ? TIME_ZONE_OPTIONS : [...TIME_ZONE_OPTIONS, { value, label: value }]),
    [value]
  );

  async function save() {
    setSaving(true);
    try {
      await requestJson("/api/business/time-zone", { method: "PATCH", body: JSON.stringify({ timeZone: value }) });
      setSaved(value);
      toast.success("Zona horaria guardada.");
    } catch {
      toast.error("No pudimos guardar la zona horaria.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-base font-semibold text-foreground">Zona horaria</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Define qué es “hoy” y “ahora” para tus turnos, la disponibilidad y el asistente de WhatsApp.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Select value={value} onValueChange={(v) => v && setValue(v)}>
          <SelectTrigger className="w-80 max-w-full" aria-label="Zona horaria del negocio">
            <SelectValue>{(v: string) => options.find((o) => o.value === v)?.label ?? v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" onClick={save} disabled={saving || value === saved}>
          {value === saved && saved ? <Check className="size-4" /> : null}
          {saving ? "Guardando…" : value === saved ? "Guardado" : "Guardar"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Ahora en esa zona: {nowLabel(value)}</p>
    </section>
  );
}
