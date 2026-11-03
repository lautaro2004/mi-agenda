import { describe, expect, it } from "vitest";
import { DEFAULT_AI_SCHEDULE, aiMayReply, aiScheduleSchema, isWithinWorkHours, type AiSchedule } from "@/lib/ai-schedule";

const TZ = "America/Argentina/Buenos_Aires";
const outside: AiSchedule = { ...DEFAULT_AI_SCHEDULE, mode: "outside_hours" };

describe("ai-schedule", () => {
  it("siempre: responde a cualquier hora", () => {
    expect(aiMayReply(DEFAULT_AI_SCHEDULE, new Date("2026-11-03T15:00:00Z"), TZ)).toBe(true);
  });
  it("martes 11:00 AR está dentro del horario laboral: la IA no responde", () => {
    const now = new Date("2026-11-03T14:00:00Z"); // 11:00 en Buenos Aires
    expect(isWithinWorkHours(outside, now, TZ)).toBe(true);
    expect(aiMayReply(outside, now, TZ)).toBe(false);
  });
  it("martes 20:00 AR está fuera: la IA responde", () => {
    expect(aiMayReply(outside, new Date("2026-11-03T23:00:00Z"), TZ)).toBe(true);
  });
  it("sábado (día sin horario laboral) responde la IA", () => {
    expect(aiMayReply(outside, new Date("2026-11-07T15:00:00Z"), TZ)).toBe(true);
  });
  it("usa la zona del negocio, no UTC", () => {
    // 21:30 AR del martes = 00:30 UTC del miércoles: fuera de horario, responde la IA
    expect(aiMayReply(outside, new Date("2026-11-04T00:30:00Z"), TZ)).toBe(true);
    // misma hora UTC en Madrid (01:30 miércoles) también fuera
    expect(aiMayReply(outside, new Date("2026-11-04T08:30:00Z"), "Europe/Madrid")).toBe(false); // 09:30 Madrid miércoles = dentro
  });
  it("el fin del horario es exclusivo", () => {
    expect(aiMayReply(outside, new Date("2026-11-03T21:00:00Z"), TZ)).toBe(true); // 18:00 AR
  });
  it("valida inicio < fin", () => {
    const bad = { ...outside, days: outside.days.map((d) => (d.day === "monday" ? { ...d, start: "18:00", end: "09:00" } : d)) };
    expect(aiScheduleSchema.safeParse(bad).success).toBe(false);
  });
});
