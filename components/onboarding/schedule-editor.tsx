"use client";

import * as React from "react";
import { Coffee, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { WEEK_DAYS, type BusinessSchedule, type BusinessScheduleDay, type SchedulePreset, type WeekDay } from "@/lib/types";
import { cn } from "@/lib/utils";

const PRESETS: { id: SchedulePreset; label: string; days: WeekDay[] }[] = [
  {
    id: "weekdays",
    label: "Lunes a viernes",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  },
  {
    id: "weekdays-saturday",
    label: "Lunes a sábado",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"],
  },
  {
    id: "every-day",
    label: "Todos los días",
    days: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
  },
];

interface ScheduleEditorProps {
  value: BusinessSchedule;
  onChange: (schedule: BusinessSchedule) => void;
  errors?: {
    [index: number]:
      | { closeTime?: { message?: string }; breakEnd?: { message?: string } }
      | undefined;
  };
}

interface DayGroup {
  key: string;
  days: WeekDay[];
  indices: number[];
  sample: BusinessScheduleDay;
}

function daySignature(day: BusinessScheduleDay) {
  return [day.enabled, day.openTime, day.closeTime, day.hasBreak, day.breakStart, day.breakEnd].join("|");
}

function buildGroups(value: BusinessSchedule): DayGroup[] {
  const groups: DayGroup[] = [];

  WEEK_DAYS.forEach((day, index) => {
    const dayValue = value[index];
    const signature = daySignature(dayValue);
    const last = groups[groups.length - 1];

    if (last && daySignature(last.sample) === signature) {
      last.days.push(day.id);
      last.indices.push(index);
      last.key += `-${index}`;
    } else {
      groups.push({ key: String(index), days: [day.id], indices: [index], sample: dayValue });
    }
  });

  return groups;
}

function dayLabel(day: WeekDay) {
  return WEEK_DAYS.find((d) => d.id === day)!.label;
}

function rangeLabel(group: DayGroup) {
  if (group.days.length === 1) return dayLabel(group.days[0]);
  return `${dayLabel(group.days[0])} a ${dayLabel(group.days[group.days.length - 1])}`;
}

function summaryText(day: BusinessScheduleDay) {
  if (!day.enabled) return "Cerrado";
  if (day.hasBreak) {
    return `${day.openTime} – ${day.breakStart}, ${day.breakEnd} – ${day.closeTime}`;
  }
  return `${day.openTime} – ${day.closeTime}`;
}

function detectPreset(schedule: BusinessSchedule): SchedulePreset {
  for (const preset of PRESETS) {
    const matches = schedule.every((day) => day.enabled === preset.days.includes(day.day));
    if (matches) return preset.id;
  }
  return "custom";
}

export function ScheduleEditor({ value, onChange, errors }: ScheduleEditorProps) {
  const [expandedDay, setExpandedDay] = React.useState<WeekDay | null>(null);
  const [copyTargets, setCopyTargets] = React.useState<Record<string, boolean>>({});

  const groups = buildGroups(value);
  const activePreset = detectPreset(value);

  React.useEffect(() => {
    if (expandedDay) return;
    for (let i = 0; i < WEEK_DAYS.length; i++) {
      if (errors?.[i]) {
        setExpandedDay(WEEK_DAYS[i].id);
        return;
      }
    }
  }, [errors, expandedDay]);

  function applyPreset(preset: { id: SchedulePreset; days: WeekDay[] }) {
    onChange(value.map((day) => ({ ...day, enabled: preset.days.includes(day.day) })));
  }

  function updateGroup(group: DayGroup, patch: Partial<BusinessScheduleDay>) {
    onChange(value.map((d, index) => (group.indices.includes(index) ? { ...d, ...patch } : d)));
  }

  function toggleExpanded(group: DayGroup) {
    setCopyTargets({});
    setExpandedDay((current) => (current && group.days.includes(current) ? null : group.days[0]));
  }

  function applyCopy(group: DayGroup) {
    const targets = Object.entries(copyTargets)
      .filter(([, checked]) => checked)
      .map(([day]) => day as WeekDay);

    if (targets.length === 0) return;

    const source = group.sample;
    onChange(
      value.map((d) =>
        targets.includes(d.day)
          ? {
              ...d,
              enabled: source.enabled,
              openTime: source.openTime,
              closeTime: source.closeTime,
              hasBreak: source.hasBreak,
              breakStart: source.breakStart,
              breakEnd: source.breakEnd,
            }
          : d
      )
    );
    setCopyTargets({});
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Esquema rápido</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant={activePreset === preset.id ? "default" : "outline"}
              size="sm"
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {groups.map((group, groupIndex) => {
          const isExpanded = expandedDay !== null && group.days.includes(expandedDay);
          const groupErrors = errors?.[group.indices[0]];

          return (
            <div key={group.key} className={cn(groupIndex > 0 && "border-t border-border")}>
              <button
                type="button"
                onClick={() => toggleExpanded(group)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                  isExpanded && "bg-muted/40"
                )}
              >
                <Switch
                  checked={group.sample.enabled}
                  onCheckedChange={(enabled) => updateGroup(group, { enabled })}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`${group.sample.enabled ? "Cerrar" : "Abrir"} ${rangeLabel(group)}`}
                />
                <span className="w-28 shrink-0 text-sm font-medium text-foreground sm:w-32">
                  {rangeLabel(group)}
                </span>
                <span
                  className={cn(
                    "flex-1 truncate text-sm",
                    group.sample.enabled ? "text-muted-foreground" : "text-muted-foreground/70"
                  )}
                >
                  {summaryText(group.sample)}
                </span>
                {!!groupErrors && (
                  <span className="size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden="true" />
                )}
                <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
              </button>

              {isExpanded && (
                <div className="space-y-4 border-t border-border bg-muted/20 px-4 py-4">
                  {group.sample.enabled ? (
                    <>
                      <div className="flex flex-wrap items-end gap-3">
                        <Field className="w-auto">
                          <FieldLabel htmlFor={`open-${group.key}`} className="text-xs text-muted-foreground">
                            Apertura
                          </FieldLabel>
                          <Input
                            id={`open-${group.key}`}
                            type="time"
                            className="w-32"
                            value={group.sample.openTime}
                            onChange={(e) => updateGroup(group, { openTime: e.target.value })}
                          />
                        </Field>
                        <Field className="w-auto">
                          <FieldLabel htmlFor={`close-${group.key}`} className="text-xs text-muted-foreground">
                            Cierre
                          </FieldLabel>
                          <Input
                            id={`close-${group.key}`}
                            type="time"
                            className="w-32"
                            value={group.sample.closeTime}
                            onChange={(e) => updateGroup(group, { closeTime: e.target.value })}
                          />
                        </Field>
                        <FieldError errors={[groupErrors?.closeTime]} />
                      </div>

                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <Switch
                            checked={group.sample.hasBreak}
                            onCheckedChange={(hasBreak) => updateGroup(group, { hasBreak })}
                          />
                          <Coffee className="size-3.5 text-muted-foreground" />
                          Descanso / almuerzo
                        </label>

                        {group.sample.hasBreak && (
                          <div className="flex flex-wrap items-end gap-3 pl-1">
                            <Field className="w-auto">
                              <FieldLabel htmlFor={`break-start-${group.key}`} className="text-xs text-muted-foreground">
                                Desde
                              </FieldLabel>
                              <Input
                                id={`break-start-${group.key}`}
                                type="time"
                                className="w-32"
                                value={group.sample.breakStart}
                                onChange={(e) => updateGroup(group, { breakStart: e.target.value })}
                              />
                            </Field>
                            <Field className="w-auto">
                              <FieldLabel htmlFor={`break-end-${group.key}`} className="text-xs text-muted-foreground">
                                Hasta
                              </FieldLabel>
                              <Input
                                id={`break-end-${group.key}`}
                                type="time"
                                className="w-32"
                                value={group.sample.breakEnd}
                                onChange={(e) => updateGroup(group, { breakEnd: e.target.value })}
                              />
                            </Field>
                            <FieldError errors={[groupErrors?.breakEnd]} />
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Este día tu negocio aparece como cerrado.
                    </p>
                  )}

                  {group.days.length < WEEK_DAYS.length && (
                    <div className="space-y-2 border-t border-border pt-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Copiar este horario a otros días
                      </p>
                      <div className="flex flex-wrap gap-3">
                        {WEEK_DAYS.filter((d) => !group.days.includes(d.id)).map((d) => (
                          <label key={d.id} className="flex items-center gap-1.5 text-sm text-foreground">
                            <Checkbox
                              checked={!!copyTargets[d.id]}
                              onCheckedChange={(checked) =>
                                setCopyTargets((prev) => ({ ...prev, [d.id]: !!checked }))
                              }
                            />
                            {d.short}
                          </label>
                        ))}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={!Object.values(copyTargets).some(Boolean)}
                        onClick={() => applyCopy(group)}
                      >
                        Aplicar a días seleccionados
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
