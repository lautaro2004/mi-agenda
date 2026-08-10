import { WEEK_DAYS, type BusinessSchedule, type BusinessScheduleDay } from "@/lib/types";

const DAY_ORDER = WEEK_DAYS.map((d) => d.id);
const DAY_LABEL = new Map(WEEK_DAYS.map((d) => [d.id, d.label]));

export interface ScheduleGroup {
  label: string;
  hours: string;
}

function sameHours(a: BusinessScheduleDay, b: BusinessScheduleDay): boolean {
  return (
    a.openTime === b.openTime &&
    a.closeTime === b.closeTime &&
    a.hasBreak === b.hasBreak &&
    a.breakStart === b.breakStart &&
    a.breakEnd === b.breakEnd
  );
}

function formatHours(day: BusinessScheduleDay): string {
  return day.hasBreak
    ? `${day.openTime} – ${day.breakStart} · ${day.breakEnd} – ${day.closeTime}`
    : `${day.openTime} – ${day.closeTime}`;
}

// Agrupa días consecutivos (en el orden real de la semana, no solo el orden
// en que vienen filtrados) que comparten exactamente el mismo horario en una
// sola línea — "Lunes a viernes / 09:00–18:00" en vez de 5 filas idénticas.
// Un hueco en el medio (ej. martes cerrado) corta el grupo aunque el resto
// vuelva a coincidir después, para no implicar que ese día también abre.
export function groupSchedule(schedule: BusinessSchedule): ScheduleGroup[] {
  const active = schedule
    .filter((d) => d.enabled)
    .slice()
    .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

  const groups: BusinessScheduleDay[][] = [];
  for (const day of active) {
    const currentGroup = groups[groups.length - 1];
    const lastDay = currentGroup?.[currentGroup.length - 1];
    const isConsecutive = lastDay ? DAY_ORDER.indexOf(day.day) === DAY_ORDER.indexOf(lastDay.day) + 1 : false;

    if (currentGroup && lastDay && isConsecutive && sameHours(lastDay, day)) {
      currentGroup.push(day);
    } else {
      groups.push([day]);
    }
  }

  return groups.map((group) => {
    const first = group[0];
    const last = group[group.length - 1];
    const label = group.length === 1 ? DAY_LABEL.get(first.day)! : `${DAY_LABEL.get(first.day)} a ${DAY_LABEL.get(last.day)}`;
    return { label, hours: formatHours(first) };
  });
}
