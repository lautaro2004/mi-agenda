import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentBusinessId = vi.fn();
vi.mock("@/modules/business/current", () => ({ getCurrentBusinessId: (...a: unknown[]) => getCurrentBusinessId(...a) }));

const canUseSmartBooking = vi.fn();
vi.mock("@/modules/billing/subscription", () => ({ canUseSmartBooking: (...a: unknown[]) => canUseSmartBooking(...a) }));

const getSmartBookingRules = vi.fn();
const saveSmartBookingRules = vi.fn();
vi.mock("@/modules/smart-booking/service", () => ({
  getSmartBookingRules: (...a: unknown[]) => getSmartBookingRules(...a),
  saveSmartBookingRules: (...a: unknown[]) => saveSmartBookingRules(...a),
}));

const { GET, PUT } = await import("./route");

const VALID = {
  mode: "assisted",
  preferredRanges: [{ from: "17:00", to: "20:00" }],
  consecutivePriority: true,
  earlyAlternatives: true,
  bufferMinutes: 10,
  reservedRanges: [{ from: "12:00", to: "13:00" }],
  approvalRanges: [],
  approvalOutsidePreferred: false,
  approvalTimeoutHours: 24,
  approvalMinLeadHours: 2,
};

const put = (body: unknown) => PUT(new Request("http://localhost/x", { method: "PUT", body: JSON.stringify(body) }));

beforeEach(() => {
  getCurrentBusinessId.mockReset().mockResolvedValue("biz_1");
  canUseSmartBooking.mockReset().mockResolvedValue(true);
  getSmartBookingRules.mockReset().mockResolvedValue({ rules: VALID, instructions: null, updatedAt: null });
  saveSmartBookingRules.mockReset().mockResolvedValue({});
});

describe("PUT /api/business/smart-booking", () => {
  it("401 sin sesión", async () => {
    getCurrentBusinessId.mockResolvedValue(null);
    expect((await put({ rules: VALID })).status).toBe(401);
    expect(saveSmartBookingRules).not.toHaveBeenCalled();
  });

  it("exige rol admin", async () => {
    await put({ rules: VALID });
    expect(getCurrentBusinessId).toHaveBeenCalledWith({ minRole: "admin" });
  });

  it("403 con upgradeRequired si el plan no incluye agenda inteligente (Esencial) y NO guarda nada", async () => {
    canUseSmartBooking.mockResolvedValue(false);
    const res = await put({ rules: VALID });
    expect(res.status).toBe(403);
    expect((await res.json()).upgradeRequired).toBe(true);
    expect(saveSmartBookingRules).not.toHaveBeenCalled();
  });

  it("guarda con un plan que la incluye (Esencial+), siempre scopeado al negocio de la sesión", async () => {
    const res = await put({ rules: VALID, instructions: "Llenar la tarde de corrido" });
    expect(res.status).toBe(200);
    expect(canUseSmartBooking).toHaveBeenCalledWith("biz_1");
    expect(saveSmartBookingRules).toHaveBeenCalledWith("biz_1", VALID, { instructions: "Llenar la tarde de corrido" });
  });

  it("ignora un businessId enviado en el body (no se puede escribir en otro negocio)", async () => {
    await put({ rules: VALID, businessId: "biz_ajeno" });
    expect(saveSmartBookingRules.mock.calls[0][0]).toBe("biz_1");
  });

  it("400 con reglas inválidas", async () => {
    const res = await put({ rules: { ...VALID, preferredRanges: [{ from: "20:00", to: "17:00" }] } });
    expect(res.status).toBe(400);
    expect(saveSmartBookingRules).not.toHaveBeenCalled();
  });

  it("500 si falla la base: no responde éxito", async () => {
    saveSmartBookingRules.mockRejectedValue(new Error("db"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await put({ rules: VALID })).status).toBe(500);
  });
});

describe("GET /api/business/smart-booking", () => {
  it("401 sin sesión", async () => {
    getCurrentBusinessId.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("devuelve las reglas guardadas y si el plan las habilita (se conservan aunque el plan baje)", async () => {
    canUseSmartBooking.mockResolvedValue(false);
    const body = await (await GET()).json();
    expect(body.allowed).toBe(false);
    expect(body.rules).toEqual(VALID);
  });
});
