import { groupSchedule } from "@/lib/schedule-format";
import type { BusinessSchedule } from "@/lib/types";

// Agrupa días consecutivos con el mismo horario en una sola fila (ver
// lib/schedule-format.ts) — "Lunes a viernes" en vez de 5 filas idénticas,
// mucho más compacto para negocios con horario uniforme entre semana.
export function ScheduleSection({ schedule }: { schedule: BusinessSchedule }) {
  const groups = groupSchedule(schedule);
  if (groups.length === 0) return null;

  return (
    <section id="horarios" className="mx-auto max-w-xl px-4 py-14 sm:px-6 sm:py-16">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Horarios de atención</h2>
      </div>

      <div className="mt-7 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {groups.map((group) => (
          <div key={group.label} className="flex items-center justify-between gap-4 px-5 py-3.5 sm:px-6">
            <span className="font-medium text-foreground">{group.label}</span>
            <span className="text-right text-sm text-muted-foreground">{group.hours}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
