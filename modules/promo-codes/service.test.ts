import { describe, expect, it, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const updateMany = vi.fn();
const update = vi.fn();
const redemptionCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    promoCode: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      updateMany: (...args: unknown[]) => updateMany(...args),
      update: (...args: unknown[]) => update(...args),
    },
    promoCodeRedemption: {
      create: (...args: unknown[]) => redemptionCreate(...args),
    },
  },
}));

const assignSubscription = vi.fn();
vi.mock("@/modules/billing/subscription", () => ({
  assignSubscription: (...args: unknown[]) => assignSubscription(...args),
}));

const { redeemPromoCode } = await import("./service");

const PLAN = { id: "plan_pro", name: "Profesional", active: true };

function mockPromoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "promo_1",
    code: "NEXO-PRO-3M-8K4F",
    planId: PLAN.id,
    plan: PLAN,
    durationDays: 90,
    maxUses: 1,
    usedCount: 0,
    expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    active: true,
    ...overrides,
  };
}

beforeEach(() => {
  findUnique.mockReset();
  updateMany.mockReset();
  update.mockReset();
  redemptionCreate.mockReset();
  assignSubscription.mockReset();
});

describe("redeemPromoCode", () => {
  it("código inexistente devuelve not_found sin tocar la base más allá del lookup", async () => {
    findUnique.mockResolvedValue(null);

    const result = await redeemPromoCode({ code: "NO-EXISTE", businessId: "biz_1", userId: "user_1" });

    expect(result).toEqual({ ok: false, error: "not_found" });
    expect(updateMany).not.toHaveBeenCalled();
    expect(assignSubscription).not.toHaveBeenCalled();
  });

  it("código vencido devuelve expired", async () => {
    findUnique.mockResolvedValue(mockPromoRow({ expiresAt: new Date("2020-01-01") }));

    const result = await redeemPromoCode({ code: "vencido", businessId: "biz_1", userId: "user_1" });

    expect(result).toEqual({ ok: false, error: "expired" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("código inactivo devuelve inactive", async () => {
    findUnique.mockResolvedValue(mockPromoRow({ active: false }));

    const result = await redeemPromoCode({ code: "inactivo", businessId: "biz_1", userId: "user_1" });

    expect(result).toEqual({ ok: false, error: "inactive" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("código agotado (usedCount ya alcanzó maxUses) devuelve exhausted sin llegar al UPDATE", async () => {
    findUnique.mockResolvedValue(mockPromoRow({ maxUses: 1, usedCount: 1 }));

    const result = await redeemPromoCode({ code: "agotado", businessId: "biz_1", userId: "user_1" });

    expect(result).toEqual({ ok: false, error: "exhausted" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("plan del código ya no está activo devuelve plan_unavailable", async () => {
    findUnique.mockResolvedValue(mockPromoRow({ plan: { ...PLAN, active: false } }));

    const result = await redeemPromoCode({ code: "plan-inactivo", businessId: "biz_1", userId: "user_1" });

    expect(result).toEqual({ ok: false, error: "plan_unavailable" });
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("código de un solo uso: aplicación correcta asigna el plan y calcula bien la fecha de fin", async () => {
    findUnique.mockResolvedValue(mockPromoRow({ maxUses: 1, usedCount: 0, durationDays: 90 }));
    updateMany.mockResolvedValue({ count: 1 });
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });
    redemptionCreate.mockResolvedValue({ id: "redemption_1" });

    const before = Date.now();
    const result = await redeemPromoCode({ code: "nexo-pro-3m-8k4f", businessId: "biz_1", userId: "user_1" });
    const after = Date.now();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok result");
    expect(result.planName).toBe("Profesional");

    const expectedMs = 90 * 24 * 60 * 60 * 1000;
    expect(result.bonusExpiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedMs);
    expect(result.bonusExpiresAt.getTime()).toBeLessThanOrEqual(after + expectedMs);

    // Reutiliza assignSubscription (sección 8 del pedido: no una segunda
    // lógica de suscripciones) con provider "promo_code" y el plan del código.
    expect(assignSubscription).toHaveBeenCalledWith(
      "biz_1",
      expect.objectContaining({ planId: PLAN.id, status: "active", provider: "promo_code" })
    );
    expect(redemptionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ promoCodeId: "promo_1", businessId: "biz_1", userId: "user_1", planNameSnapshot: "Profesional" }),
      })
    );
  });

  it("código de múltiples usos: se puede aplicar mientras no llegue al límite", async () => {
    findUnique.mockResolvedValue(mockPromoRow({ maxUses: 50, usedCount: 12 }));
    updateMany.mockResolvedValue({ count: 1 });
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });
    redemptionCreate.mockResolvedValue({ id: "redemption_2" });

    const result = await redeemPromoCode({ code: "multi", businessId: "biz_2", userId: "user_2" });

    expect(result.ok).toBe(true);
    // El guard de concurrencia respeta maxUses también para códigos
    // multi-uso, no solo para los de un solo uso.
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ usedCount: { lt: 50 } }) })
    );
  });

  it("código sin límite de usos no agrega condición de usedCount al UPDATE", async () => {
    findUnique.mockResolvedValue(mockPromoRow({ maxUses: null, usedCount: 9999 }));
    updateMany.mockResolvedValue({ count: 1 });
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });
    redemptionCreate.mockResolvedValue({ id: "redemption_3" });

    await redeemPromoCode({ code: "ilimitado", businessId: "biz_3", userId: "user_3" });

    const call = updateMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty("usedCount");
  });

  it("uso concurrente: dos canjes simultáneos del mismo código de un solo uso — solo uno gana", async () => {
    // Simula el UPDATE atómico de Postgres: la primera llamada encuentra la
    // fila (usedCount < maxUses todavía verdadero) y la actualiza; para
    // cuando llega la segunda, la condición del WHERE ya no matchea nada
    // (count: 0) — así se comporta un UPDATE...WHERE real bajo concurrencia,
    // sin necesidad de SELECT FOR UPDATE.
    findUnique.mockResolvedValue(mockPromoRow({ maxUses: 1, usedCount: 0 }));
    updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });
    redemptionCreate.mockResolvedValue({ id: "redemption_4" });

    const [first, second] = await Promise.all([
      redeemPromoCode({ code: "race", businessId: "biz_a", userId: "user_a" }),
      redeemPromoCode({ code: "race", businessId: "biz_b", userId: "user_b" }),
    ]);

    const results = [first, second];
    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);

    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]).toEqual({ ok: false, error: "exhausted" });
    // Solo el ganador dispara la asignación real del plan.
    expect(assignSubscription).toHaveBeenCalledTimes(1);
  });

  it("si assignSubscription falla después de reservar el uso, revierte el usedCount (no deja un uso cobrado sin beneficio)", async () => {
    findUnique.mockResolvedValue(mockPromoRow({ maxUses: 1, usedCount: 0 }));
    updateMany.mockResolvedValue({ count: 1 });
    assignSubscription.mockResolvedValue({ ok: false, error: "plan_inactive" });

    const result = await redeemPromoCode({ code: "falla-al-final", businessId: "biz_1", userId: "user_1" });

    expect(result).toEqual({ ok: false, error: "plan_unavailable" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "promo_1" }, data: { usedCount: { decrement: 1 } } })
    );
    expect(redemptionCreate).not.toHaveBeenCalled();
  });

  it("normaliza el código antes de buscarlo (minúsculas/espacios no importan)", async () => {
    findUnique.mockResolvedValue(mockPromoRow());
    updateMany.mockResolvedValue({ count: 1 });
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });
    redemptionCreate.mockResolvedValue({ id: "redemption_5" });

    await redeemPromoCode({ code: "  nexo-pro-3m-8k4f  ", businessId: "biz_1", userId: "user_1" });

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: "NEXO-PRO-3M-8K4F" } })
    );
  });
});
