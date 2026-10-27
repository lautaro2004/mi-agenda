import { describe, expect, it } from "vitest";

import {
  DEFAULT_SMART_BOOKING_RULES,
  classifySlots,
  computeApprovalExpiry,
  decideBooking,
  parseStoredRules,
  proposeSlots,
  smartBookingRulesSchema,
  type SmartBookingRules,
} from "./smart-booking";

const rules = (over: Partial<SmartBookingRules> = {}): SmartBookingRules => ({ ...DEFAULT_SMART_BOOKING_RULES, ...over });
const SLOTS = ["10:00", "11:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];

describe("classifySlots", () => {
  it("sin reglas no cambia nada: ofrece todo lo que el motor real devolvió, en orden", () => {
    const { offerable, blocked } = classifySlots({ slots: SLOTS, existing: [], durationMinutes: 60, rules: rules() });
    expect(offerable.map((s) => s.time)).toEqual(SLOTS);
    expect(blocked).toEqual([]);
    expect(offerable.every((s) => s.status === "available")).toBe(true);
  });

  it("nunca agrega horarios que el motor real no devolvió (ocupados quedan afuera)", () => {
    const { offerable } = classifySlots({
      slots: ["10:00", "18:00"], // 11:00..17:00 ocupados
      existing: [],
      durationMinutes: 60,
      rules: rules({ preferredRanges: [{ from: "10:00", to: "20:00" }] }),
    });
    expect(offerable.map((s) => s.time).sort()).toEqual(["10:00", "18:00"]);
  });

  it("prioriza los horarios preferidos sin descartar los demás permitidos", () => {
    const { offerable } = classifySlots({
      slots: SLOTS,
      existing: [],
      durationMinutes: 60,
      rules: rules({ preferredRanges: [{ from: "17:00", to: "19:00" }] }),
    });
    expect(offerable.slice(0, 2).map((s) => s.time)).toEqual(["17:00", "18:00"]);
    expect(offerable.slice(0, 2).every((s) => s.status === "preferred")).toBe(true);
    expect(offerable).toHaveLength(SLOTS.length);
  });

  it("prioridad por horarios consecutivos: pega el turno nuevo a uno existente", () => {
    const { offerable } = classifySlots({
      slots: ["15:00", "16:00", "17:00", "18:00"],
      existing: [{ startTime: "14:00", durationMinutes: 60 }],
      durationMinutes: 60,
      rules: rules({ consecutivePriority: true }),
    });
    expect(offerable[0]).toMatchObject({ time: "15:00", consecutive: true });
  });

  it("los espacios reservados para atención espontánea no se ofrecen (se informan como bloqueados)", () => {
    const { offerable, blocked } = classifySlots({
      slots: SLOTS,
      existing: [],
      durationMinutes: 60,
      rules: rules({ reservedRanges: [{ from: "18:00", to: "20:00" }] }),
    });
    expect(offerable.map((s) => s.time)).not.toContain("18:00");
    expect(offerable.map((s) => s.time)).not.toContain("19:00");
    expect(blocked).toEqual([
      { time: "18:00", reason: "reserved" },
      { time: "19:00", reason: "reserved" },
    ]);
  });

  it("un servicio largo no puede invadir un espacio reservado", () => {
    const { offerable } = classifySlots({
      slots: ["17:00", "20:00"],
      existing: [],
      durationMinutes: 90, // 17:00-18:30 pisa 18:00-20:00
      rules: rules({ reservedRanges: [{ from: "18:00", to: "20:00" }] }),
    });
    expect(offerable.map((s) => s.time)).toEqual(["20:00"]);
  });

  it("aplica el margen entre servicios", () => {
    const { offerable, blocked } = classifySlots({
      slots: ["15:00", "15:30", "16:30"],
      existing: [{ startTime: "14:00", durationMinutes: 60 }], // termina 15:00
      durationMinutes: 30,
      rules: rules({ bufferMinutes: 15 }),
    });
    expect(blocked.map((b) => b.time)).toEqual(["15:00"]); // pegado: sin margen
    expect(offerable.map((s) => s.time)).toEqual(["15:30", "16:30"]);
  });

  it("marca como 'necesita aprobación' lo fuera de los preferidos si el negocio lo pide", () => {
    const { offerable } = classifySlots({
      slots: ["10:00", "18:00"],
      existing: [],
      durationMinutes: 60,
      rules: rules({ preferredRanges: [{ from: "17:00", to: "20:00" }], approvalOutsidePreferred: true }),
    });
    expect(offerable.find((s) => s.time === "10:00")?.status).toBe("needs_approval");
    expect(offerable.find((s) => s.time === "18:00")?.status).toBe("preferred");
    // los que necesitan aprobación quedan al final
    expect(offerable[0].time).toBe("18:00");
  });

  it("rangos de aprobación explícitos", () => {
    const { offerable } = classifySlots({
      slots: ["09:00", "12:00"],
      existing: [],
      durationMinutes: 60,
      rules: rules({ approvalRanges: [{ from: "09:00", to: "10:00" }] }),
    });
    expect(offerable.find((s) => s.time === "09:00")?.status).toBe("needs_approval");
    expect(offerable.find((s) => s.time === "12:00")?.status).toBe("available");
  });
});

describe("proposeSlots — negociación", () => {
  const preferred = { preferredRanges: [{ from: "17:00", to: "19:00" }], earlyAlternatives: true };
  const classified = (r: SmartBookingRules) => classifySlots({ slots: SLOTS, existing: [], durationMinutes: 60, rules: r });

  it("pidió las 19:00 y es flexible: primero pregunta por 17:00/18:00", () => {
    const r = rules(preferred);
    const p = proposeSlots(classified(r), { requestedTime: "20:00", flexible: true }, r);
    expect(p.askFirst).toBe(true);
    expect(p.options.slice(0, 2).map((s) => s.time)).toEqual(["17:00", "18:00"]);
    expect(p.requestedAvailable).toBe(true);
  });

  it("si el cliente no es flexible, ofrece lo pedido primero", () => {
    const r = rules(preferred);
    const p = proposeSlots(classified(r), { requestedTime: "20:00", flexible: false }, r);
    expect(p.askFirst).toBe(false);
    expect(p.options[0].time).toBe("20:00");
  });

  it("respeta las restricciones del cliente: 'salgo a las 18:30' no recibe 17:00 ni 18:00", () => {
    const r = rules(preferred);
    const p = proposeSlots(classified(r), { requestedTime: "19:00", notBefore: "18:30", flexible: true }, r);
    expect(p.options.map((s) => s.time).every((t) => t >= "18:30")).toBe(true);
    expect(p.options[0].time).toBe("19:00");
    expect(p.askFirst).toBe(false);
  });

  it("si el horario pedido no está disponible, propone alternativas y lo informa", () => {
    const r = rules();
    const p = proposeSlots(classified(r), { requestedTime: "12:00" }, r);
    expect(p.requestedAvailable).toBe(false);
    expect(p.options.length).toBeGreaterThan(0);
  });

  it("sin la regla de alternativas tempranas no pregunta primero", () => {
    const r = rules({ preferredRanges: preferred.preferredRanges, earlyAlternatives: false });
    const p = proposeSlots(classified(r), { requestedTime: "20:00", flexible: true }, r);
    expect(p.askFirst).toBe(false);
  });

  it("no ofrece nada que esté bloqueado por las reglas", () => {
    const r = rules({ reservedRanges: [{ from: "19:00", to: "21:00" }] });
    const p = proposeSlots(classified(r), { requestedTime: "19:00" }, r, 10);
    expect(p.requestedAvailable).toBe(false);
    expect(p.options.map((s) => s.time)).not.toContain("19:00");
    expect(p.options.map((s) => s.time)).not.toContain("20:00");
  });
});

describe("decideBooking", () => {
  it("manual: nunca confirma, siempre espera al dueño", () => {
    expect(decideBooking("manual", { status: "preferred" })).toBe("needs_approval");
    expect(decideBooking("manual", { status: "available" })).toBe("needs_approval");
  });
  it("auto y asistido confirman lo que cumple las reglas", () => {
    for (const mode of ["auto", "assisted"] as const) {
      expect(decideBooking(mode, { status: "preferred" })).toBe("confirm");
      expect(decideBooking(mode, { status: "available" })).toBe("confirm");
    }
  });
  it("auto y asistido NO confirman los horarios que requieren aprobación", () => {
    expect(decideBooking("auto", { status: "needs_approval" })).toBe("needs_approval");
    expect(decideBooking("assisted", { status: "needs_approval" })).toBe("needs_approval");
  });
});

describe("validación de reglas", () => {
  it("rechaza rangos invertidos y horas mal formadas", () => {
    expect(smartBookingRulesSchema.safeParse({ ...DEFAULT_SMART_BOOKING_RULES, preferredRanges: [{ from: "19:00", to: "17:00" }] }).success).toBe(false);
    expect(smartBookingRulesSchema.safeParse({ ...DEFAULT_SMART_BOOKING_RULES, reservedRanges: [{ from: "7pm", to: "9pm" }] }).success).toBe(false);
  });
  it("limita el margen y el modo", () => {
    expect(smartBookingRulesSchema.safeParse({ ...DEFAULT_SMART_BOOKING_RULES, bufferMinutes: 500 }).success).toBe(false);
    expect(smartBookingRulesSchema.safeParse({ ...DEFAULT_SMART_BOOKING_RULES, mode: "libre" }).success).toBe(false);
  });
  it("lo guardado inválido o vacío cae en el default seguro (asistido, sin restricciones)", () => {
    expect(parseStoredRules(null)).toEqual(DEFAULT_SMART_BOOKING_RULES);
    expect(parseStoredRules({ bufferMinutes: "x" })).toEqual(DEFAULT_SMART_BOOKING_RULES);
    expect(parseStoredRules({ bufferMinutes: 10 }, "manual")).toMatchObject({ mode: "manual", bufferMinutes: 10 });
  });
});

describe("computeApprovalExpiry", () => {
  const H = 3_600_000;
  const now = new Date("2026-10-27T12:00:00Z");
  const r = { approvalTimeoutHours: 24, approvalMinLeadHours: 2 };

  it("turno lejano: vence a las horas de espera configuradas", () => {
    const start = new Date(now.getTime() + 5 * 24 * H);
    expect(computeApprovalExpiry(now, start, r)).toEqual(new Date(now.getTime() + 24 * H));
  });

  it("turno cercano: vence antes, con el margen mínimo previo al turno", () => {
    const start = new Date(now.getTime() + 10 * H);
    expect(computeApprovalExpiry(now, start, r)).toEqual(new Date(start.getTime() - 2 * H));
  });

  it("turno muy próximo: el dueño igual tiene 15 minutos, nunca más allá del inicio", () => {
    expect(computeApprovalExpiry(now, new Date(now.getTime() + 1 * H), r)).toEqual(new Date(now.getTime() + 15 * 60_000));
    const soon = new Date(now.getTime() + 5 * 60_000);
    expect(computeApprovalExpiry(now, soon, r).getTime()).toBeLessThanOrEqual(soon.getTime() + 60_000);
  });
});
