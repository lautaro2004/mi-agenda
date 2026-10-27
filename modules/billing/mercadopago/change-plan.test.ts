import { beforeEach, describe, expect, it, vi } from "vitest";

const { subFind, subUpdate, memberCount, inviteCount, updateAmount, getPlanById } = vi.hoisted(() => ({
  subFind: vi.fn(),
  subUpdate: vi.fn(),
  memberCount: vi.fn(),
  inviteCount: vi.fn(),
  updateAmount: vi.fn(),
  getPlanById: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    subscription: { findUnique: subFind, update: subUpdate },
    membership: { count: memberCount },
    invitation: { count: inviteCount },
  },
}));
vi.mock("@/modules/billing/mercadopago/subscriptions", () => ({ updatePreapprovalAmount: updateAmount }));
vi.mock("@/modules/billing/subscription", () => ({ getPlanById }));
vi.mock("@/lib/fx", () => ({
  FxUnavailableError: class extends Error {},
  needsConversion: (c: string) => c.toUpperCase() !== "ARS",
  convertToArs: (n: number, rate: number) => Math.round(n * rate * 100) / 100,
  getUsdArsRate: vi.fn().mockResolvedValue({ rate: 1000 }),
}));

import { changePlan } from "./change-plan";

const baseSub = {
  planId: "p1",
  provider: "mercadopago",
  status: "active",
  providerSubscriptionId: "pre_1",
  arsAmount: 50000,
  billingInterval: "month",
  extraUsers: 0,
};
const target = {
  id: "p2",
  name: "Equipo",
  active: true,
  products: ["crm"],
  crmMaxUsers: 5,
  monthlyPrice: 100,
  currency: "USD",
  extraUserMonthlyPrice: 10,
  extraUserYearlyPrice: 100,
  prices: [],
};

beforeEach(() => {
  [subFind, subUpdate, memberCount, inviteCount, updateAmount, getPlanById].forEach((m) => m.mockReset());
  subFind.mockResolvedValue({ ...baseSub, plan: { id: "p1" } });
  getPlanById.mockResolvedValue(target);
  memberCount.mockResolvedValue(2);
  inviteCount.mockResolvedValue(0);
  updateAmount.mockResolvedValue({});
});

describe("changePlan", () => {
  it("cambia el plan: primero Mercado Pago, después la base", async () => {
    const r = await changePlan("b1", { planId: "p2", extraUsers: 1 });
    expect(r).toMatchObject({ ok: true, changed: true, seatLimit: 6, arsAmount: 110000 });
    expect(updateAmount).toHaveBeenCalledWith("pre_1", 110000);
    expect(subUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ planId: "p2", extraUsers: 1, arsAmount: 110000 }) }));
  });

  it("si Mercado Pago rechaza no toca la base", async () => {
    updateAmount.mockRejectedValue(new Error("mp"));
    const r = await changePlan("b1", { planId: "p2" });
    expect(r).toMatchObject({ ok: false, error: "MERCADOPAGO_ERROR" });
    expect(subUpdate).not.toHaveBeenCalled();
  });

  it("no baja a un plan donde no entran los usuarios actuales", async () => {
    memberCount.mockResolvedValue(5);
    inviteCount.mockResolvedValue(1);
    const r = await changePlan("b1", { planId: "p2" });
    expect(r).toMatchObject({ ok: false, error: "SEATS_IN_USE" });
    expect(updateAmount).not.toHaveBeenCalled();
  });

  it("es idempotente si pide lo mismo", async () => {
    subFind.mockResolvedValue({ ...baseSub, planId: "p2", plan: { id: "p2" } });
    const r = await changePlan("b1", { planId: "p2" });
    expect(r).toMatchObject({ ok: true, changed: false });
    expect(updateAmount).not.toHaveBeenCalled();
  });

  it("rechaza suscripciones sin monto dinámico, planes sin Nodo y períodos sin precio", async () => {
    subFind.mockResolvedValue({ ...baseSub, arsAmount: null, plan: { id: "p1" } });
    expect(await changePlan("b1", { planId: "p2" })).toMatchObject({ error: "NOT_SUPPORTED" });

    subFind.mockResolvedValue({ ...baseSub, plan: { id: "p1" } });
    getPlanById.mockResolvedValue({ ...target, products: ["nexo"] });
    expect(await changePlan("b1", { planId: "p2" })).toMatchObject({ error: "PLAN_NOT_AVAILABLE" });

    getPlanById.mockResolvedValue(target);
    subFind.mockResolvedValue({ ...baseSub, billingInterval: "year", plan: { id: "p1" } });
    expect(await changePlan("b1", { planId: "p2" })).toMatchObject({ error: "PLAN_NOT_AVAILABLE" });
  });
});
