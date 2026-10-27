import { beforeEach, describe, expect, it, vi } from "vitest";

const { planFind, getUsdArsRate } = vi.hoisted(() => ({
  planFind: vi.fn(async (_args: { where: { id: string } }): Promise<unknown> => null),
  getUsdArsRate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: { plan: { findUnique: planFind } } }));
vi.mock("@/lib/fx", () => ({
  FxUnavailableError: class FxUnavailableError extends Error {},
  needsConversion: (c: string) => c.toUpperCase() !== "ARS",
  convertToArs: (n: number, rate: number) => Math.round(n * rate * 100) / 100,
  getUsdArsRate,
}));

import { FxUnavailableError } from "@/lib/fx";
import { computeCharge, isComboPlan, type ChargePlan } from "./pricing";

const crmUsd: ChargePlan = {
  id: "crm1",
  monthlyPrice: 50,
  currency: "USD",
  products: ["crm"],
  extraUserMonthlyPrice: 10,
  extraUserYearlyPrice: 100,
  prices: [{ interval: "year", amount: 500, currency: "USD", active: true }],
};
const nexoArs: ChargePlan = { id: "nx1", monthlyPrice: 30000, currency: "ARS", products: ["nexo"], prices: [{ interval: "year", amount: 300000, currency: "ARS", active: true }] };
const combo: ChargePlan = {
  id: "cb1",
  monthlyPrice: 0,
  currency: "ARS",
  products: ["nexo", "crm"],
  comboDiscountPct: 20,
  packNexoPlanId: "nx1",
  packCrmPlanId: "crm1",
};

beforeEach(() => {
  planFind.mockReset().mockImplementation(async ({ where }: { where: { id: string } }) => (where.id === "nx1" ? { ...nexoArs } : where.id === "crm1" ? { ...crmUsd } : null));
  getUsdArsRate.mockReset().mockResolvedValue({ rate: 1000, asOf: new Date("2026-10-27T12:00:00Z"), source: "bna" });
});

describe("computeCharge — plan común", () => {
  it("plan en pesos: sin cotización", async () => {
    const r = await computeCharge(nexoArs, "month", 0);
    expect(r).toMatchObject({ ok: true, arsAmount: 30000, converted: false });
    expect(getUsdArsRate).not.toHaveBeenCalled();
  });

  it("plan en dólares: convierte al dólar del día, con extras", async () => {
    const r = await computeCharge(crmUsd, "month", 2);
    expect(r).toMatchObject({ ok: true, arsAmount: 70000, converted: true, rate: 1000, listAmount: 70, listCurrency: "USD" });
  });

  it("anual sin precio, extras no ofrecidos y cotización caída", async () => {
    expect(await computeCharge({ ...crmUsd, prices: [] }, "year", 0)).toEqual({ ok: false, error: "PRICE_NOT_AVAILABLE" });
    expect(await computeCharge(nexoArs, "month", 1)).toEqual({ ok: false, error: "EXTRA_USERS_NOT_AVAILABLE" });
    getUsdArsRate.mockRejectedValue(new FxUnavailableError());
    expect(await computeCharge(crmUsd, "month", 0)).toEqual({ ok: false, error: "FX_UNAVAILABLE" });
  });
});

describe("computeCharge — combo", () => {
  it("20 % sobre la suma de Nexo (ARS) + Nodo (USD al dólar del día)", async () => {
    expect(isComboPlan(combo)).toBe(true);
    const r = await computeCharge(combo, "month", 0);
    // (30.000 + 50 × 1.000) = 80.000 → −20 % = 64.000
    expect(r).toMatchObject({ ok: true, arsAmount: 64000, converted: true, combo: { discountPct: 20, subtotalArs: 80000, discountArs: 16000 } });
  });

  it("los usuarios extra no llevan descuento", async () => {
    const r = await computeCharge(combo, "month", 2);
    expect(r).toMatchObject({ ok: true, arsAmount: 84000 });
  });

  it("anual: usa los precios anuales de ambos", async () => {
    const r = await computeCharge(combo, "year", 0);
    // (300.000 + 500 × 1.000) = 800.000 → −20 % = 640.000
    expect(r).toMatchObject({ ok: true, arsAmount: 640000 });
  });

  it("si falta algún plan o un precio, no cobra", async () => {
    planFind.mockImplementation(async ({ where }: { where: { id: string } }) => (where.id === "nx1" ? { ...nexoArs, prices: [] } : { ...crmUsd }));
    expect(await computeCharge(combo, "year", 0)).toEqual({ ok: false, error: "PRICE_NOT_AVAILABLE" });
    planFind.mockResolvedValue(null);
    expect(await computeCharge(combo, "month", 0)).toEqual({ ok: false, error: "PRICE_NOT_AVAILABLE" });
    expect(await computeCharge({ ...combo, packCrmPlanId: null }, "month", 0)).toEqual({ ok: false, error: "PRICE_NOT_AVAILABLE" });
  });
});
