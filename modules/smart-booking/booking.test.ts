import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SMART_BOOKING_RULES, type SmartBookingRules } from "@/lib/smart-booking";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { appointment: { findMany: (...a: unknown[]) => findMany(...a) } } }));

const getAvailableSlots = vi.fn();
vi.mock("@/modules/appointments/service", () => ({ getAvailableSlots: (...a: unknown[]) => getAvailableSlots(...a) }));

const canUseSmartBooking = vi.fn();
vi.mock("@/modules/billing/subscription", () => ({ canUseSmartBooking: (...a: unknown[]) => canUseSmartBooking(...a) }));

const getSmartBookingRules = vi.fn();
vi.mock("./service", () => ({ getSmartBookingRules: (...a: unknown[]) => getSmartBookingRules(...a) }));

const { getSmartAvailability, evaluateBooking } = await import("./booking");

const DAY = { businessId: "biz_1", date: "2026-10-28", schedule: [] as never, serviceId: "svc", durationMinutes: 60 };
const rules = (over: Partial<SmartBookingRules> = {}) => ({ ...DEFAULT_SMART_BOOKING_RULES, ...over });
const useRules = (r: SmartBookingRules) => getSmartBookingRules.mockResolvedValue({ rules: r, instructions: null, updatedAt: null });

beforeEach(() => {
  for (const m of [findMany, getAvailableSlots, canUseSmartBooking, getSmartBookingRules]) m.mockReset();
  canUseSmartBooking.mockResolvedValue(true);
  findMany.mockResolvedValue([]);
  getAvailableSlots.mockResolvedValue(["10:00", "17:00", "18:00", "19:00"]);
  useRules(rules());
});

describe("plan sin agenda inteligente (Esencial, Gratis)", () => {
  beforeEach(() => canUseSmartBooking.mockResolvedValue(false));

  it("getSmartAvailability devuelve null: el caller usa el motor de siempre, sin consultar reglas", async () => {
    expect(await getSmartAvailability(DAY)).toBeNull();
    expect(getSmartBookingRules).not.toHaveBeenCalled();
    expect(getAvailableSlots).not.toHaveBeenCalled();
  });

  it("evaluateBooking confirma sin tocar nada, aunque haya reglas guardadas de un plan anterior", async () => {
    useRules(rules({ mode: "manual", reservedRanges: [{ from: "00:00", to: "23:59" }] }));
    expect(await evaluateBooking({ ...DAY, startTime: "10:00" })).toEqual({ ok: true, decision: "confirm", approvalExpiresAt: null });
  });
});

describe("getSmartAvailability", () => {
  it("devuelve horarios cronológicos y marca preferidos y los que necesitan aprobación", async () => {
    useRules(rules({ preferredRanges: [{ from: "17:00", to: "19:00" }], approvalOutsidePreferred: true }));
    const res = await getSmartAvailability(DAY);
    expect(res?.slots).toEqual(["10:00", "17:00", "18:00", "19:00"]);
    expect(res?.preferred).toEqual(["17:00", "18:00"]);
    expect(res?.needsApproval).toEqual(["10:00", "19:00"]);
  });

  it("no ofrece los espacios reservados y nunca agrega horarios que el motor real no devolvió", async () => {
    getAvailableSlots.mockResolvedValue(["10:00", "18:00"]); // el resto está ocupado
    useRules(rules({ reservedRanges: [{ from: "18:00", to: "19:00" }] }));
    expect((await getSmartAvailability(DAY))?.slots).toEqual(["10:00"]);
  });

  it("consulta los turnos del día solo del negocio indicado", async () => {
    await getSmartAvailability(DAY);
    expect(findMany.mock.calls[0][0].where).toMatchObject({ businessId: "biz_1", date: "2026-10-28" });
  });
});

describe("evaluateBooking", () => {
  const NOW = new Date("2026-10-27T15:00:00Z");

  it("rechaza un horario que ya no es ofrecible (ocupado o reservado)", async () => {
    useRules(rules({ reservedRanges: [{ from: "18:00", to: "19:00" }] }));
    expect(await evaluateBooking({ ...DAY, startTime: "18:00", now: NOW })).toEqual({ ok: false, reason: "slot_unavailable" });
    getAvailableSlots.mockResolvedValue(["10:00"]);
    expect(await evaluateBooking({ ...DAY, startTime: "17:00", now: NOW })).toEqual({ ok: false, reason: "slot_unavailable" });
  });

  it("asistido: confirma un horario válido", async () => {
    expect(await evaluateBooking({ ...DAY, startTime: "17:00", now: NOW })).toEqual({ ok: true, decision: "confirm", approvalExpiresAt: null });
  });

  it("manual: nunca confirma; retiene el horario hasta un vencimiento", async () => {
    useRules(rules({ mode: "manual" }));
    const res = await evaluateBooking({ ...DAY, startTime: "17:00", now: NOW });
    expect(res).toMatchObject({ ok: true, decision: "needs_approval" });
    if (res.ok) expect(res.approvalExpiresAt!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("horario que requiere aprobación: pendiente con vencimiento a las horas configuradas", async () => {
    useRules(rules({ approvalRanges: [{ from: "10:00", to: "11:00" }], approvalTimeoutHours: 12, approvalMinLeadHours: 2 }));
    const res = await evaluateBooking({ ...DAY, startTime: "10:00", now: NOW });
    expect(res).toMatchObject({ ok: true, decision: "needs_approval" });
    if (res.ok) expect(res.approvalExpiresAt).toEqual(new Date(NOW.getTime() + 12 * 3_600_000));
  });
});
