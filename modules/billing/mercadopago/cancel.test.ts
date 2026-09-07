import { describe, expect, it, vi, beforeEach } from "vitest";

const getSubscriptionWithPlan = vi.fn();
const assignSubscription = vi.fn();
const getDefaultPlan = vi.fn();
const cancelPreapproval = vi.fn();

vi.mock("@/modules/billing/subscription", () => ({
  getSubscriptionWithPlan: (...args: unknown[]) => getSubscriptionWithPlan(...args),
  assignSubscription: (...args: unknown[]) => assignSubscription(...args),
  getDefaultPlan: (...args: unknown[]) => getDefaultPlan(...args),
}));

vi.mock("@/modules/billing/mercadopago/subscriptions", () => ({
  cancelPreapproval: (...args: unknown[]) => cancelPreapproval(...args),
}));

const { cancelSubscription } = await import("./cancel");

const MERCADOPAGO_SUB = {
  planId: "plan_esencial",
  provider: "mercadopago",
  providerSubscriptionId: "preapproval_1",
  status: "active",
  currentPeriodStart: new Date("2026-08-01"),
  currentPeriodEnd: null,
};

const GRATIS_PLAN = { id: "plan_gratis", slug: "gratis" };

beforeEach(() => {
  getSubscriptionWithPlan.mockReset();
  assignSubscription.mockReset();
  getDefaultPlan.mockReset();
  cancelPreapproval.mockReset();
  getDefaultPlan.mockResolvedValue(GRATIS_PLAN);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("cancelSubscription", () => {
  it("no_subscription si el negocio no tiene Subscription", async () => {
    getSubscriptionWithPlan.mockResolvedValue(null);

    const result = await cancelSubscription("biz_1");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("no_subscription");
    expect(cancelPreapproval).not.toHaveBeenCalled();
  });

  it("not_mercadopago si el plan actual no viene de Mercado Pago (ej. manual/benefit/promo)", async () => {
    getSubscriptionWithPlan.mockResolvedValue({ provider: "benefit", providerSubscriptionId: null });

    const result = await cancelSubscription("biz_1");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("not_mercadopago");
    expect(cancelPreapproval).not.toHaveBeenCalled();
  });

  it("cancela el preapproval real en Mercado Pago con el providerSubscriptionId correcto", async () => {
    getSubscriptionWithPlan.mockResolvedValue(MERCADOPAGO_SUB);
    cancelPreapproval.mockResolvedValue({ id: "preapproval_1", status: "cancelled" });
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });

    await cancelSubscription("biz_1");

    expect(cancelPreapproval).toHaveBeenCalledWith("preapproval_1");
  });

  it("al cancelar, vuelve el negocio a Gratis de inmediato (no deja un plan pago 'canceled' con sus features visibles)", async () => {
    getSubscriptionWithPlan.mockResolvedValue(MERCADOPAGO_SUB);
    cancelPreapproval.mockResolvedValue({ id: "preapproval_1", status: "cancelled" });
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });

    const result = await cancelSubscription("biz_1");

    expect(assignSubscription).toHaveBeenCalledWith(
      "biz_1",
      expect.objectContaining({ planId: "plan_gratis", status: "active", provider: "manual" })
    );
    expect(result.ok).toBe(true);
  });

  it("mercadopago_error si Mercado Pago rechaza la cancelación — no toca la Subscription de Nexo", async () => {
    getSubscriptionWithPlan.mockResolvedValue(MERCADOPAGO_SUB);
    cancelPreapproval.mockRejectedValue(new Error("timeout"));

    const result = await cancelSubscription("biz_1");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("mercadopago_error");
    expect(assignSubscription).not.toHaveBeenCalled();
  });

  it("unexpected_error si algo no previsto lanza, nunca deja escapar la excepción cruda", async () => {
    getSubscriptionWithPlan.mockRejectedValue(new Error("db caída"));

    const result = await cancelSubscription("biz_1");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("unexpected_error");
  });

  it("si Mercado Pago ya canceló pero assignSubscription falla del lado de Nexo, no revierte ni miente sobre el resultado", async () => {
    getSubscriptionWithPlan.mockResolvedValue(MERCADOPAGO_SUB);
    cancelPreapproval.mockResolvedValue({ id: "preapproval_1", status: "cancelled" });
    assignSubscription.mockResolvedValue({ ok: false, error: "plan_inactive" });

    const result = await cancelSubscription("biz_1");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("unexpected_error");
  });
});
