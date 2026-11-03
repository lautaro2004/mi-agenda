import { z } from "zod";

import { WEEK_DAYS, type WeekDay } from "@/lib/types";
import { DEFAULT_TIME_ZONE, resolveTimeZone } from "@/lib/time-zone";

// Horario de la IA de WhatsApp. Dos modos:
// - "always": la IA responde siempre (comportamiento de antes).
// - "outside_hours": la IA responde SOLO fuera del horario laboral del
//   equipo. Dentro del horario laboral no contesta: atiende una persona.
// El interruptor general de la IA (modo manual) sigue mandando: apagado, la IA
// no responde nunca, haya o no horario.

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM)");

const dayWindow = z.object({
  day: z.enum(WEEK_DAYS.map((d) => d.id) as [WeekDay, ...WeekDay[]]),
  enabled: z.boolean(),
  start: time,
  end: time,
});

export const aiScheduleSchema = z
  .object({
    mode: z.enum(["always", "outside_hours"]),
    days: z.array(dayWindow).length(7),
  })
  .refine((s) => s.days.every((d) => !d.enabled || d.start < d.end), {
    message: "En cada día activo, la hora de inicio tiene que ser anterior a la de fin.",
    path: ["days"],
  });

export type AiSchedule = z.infer<typeof aiScheduleSchema>;

export const DEFAULT_AI_SCHEDULE: AiSchedule = {
  mode: "always",
  days: WEEK_DAYS.map((d) => ({
    day: d.id,
    enabled: d.id !== "saturday" && d.id !== "sunday",
    start: "09:00",
    end: "18:00",
  })),
};

export function resolveAiSchedule(saved: unknown): AiSchedule {
  const parsed = aiScheduleSchema.safeParse(saved);
  return parsed.success ? parsed.data : DEFAULT_AI_SCHEDULE;
}

const JS_DAY: WeekDay[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

// Día de la semana y hora "HH:MM" en la zona del negocio.
export function localDayAndTime(now: Date, timeZone: string | null | undefined): { day: WeekDay; time: string } {
  const tz = resolveTimeZone(timeZone ?? DEFAULT_TIME_ZONE);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day: JS_DAY[dayIdx < 0 ? 0 : dayIdx], time: `${get("hour")}:${get("minute")}` };
}

export function isWithinWorkHours(schedule: AiSchedule, now: Date, timeZone: string | null | undefined): boolean {
  const { day, time: t } = localDayAndTime(now, timeZone);
  const window = schedule.days.find((d) => d.day === day);
  return !!window && window.enabled && t >= window.start && t < window.end;
}

// ¿La IA puede responder ahora? (sin contar el interruptor general)
export function aiMayReply(schedule: AiSchedule, now: Date, timeZone: string | null | undefined): boolean {
  if (schedule.mode === "always") return true;
  return !isWithinWorkHours(schedule, now, timeZone);
}
