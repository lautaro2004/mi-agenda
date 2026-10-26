import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { subscription: { findMany: (...a: unknown[]) => findMany(...a) } } }));

const getSubscriptionWithPlan = vi.fn();
const assignSubscription = vi.fn();
vi.mock("@/modules/billing/subscription", () => ({
  getSubscriptionWithPlan: (...a: unknown[]) => getSubscriptionWithPlan(...a),
  assignSubscription: (...a: unknown[]) => assignSubscription(...a),
}));

const getPreapproval = vi.fn();
vi.mock("@/modules/billing/mercadopago/subscriptions", () => ({ getPreapproval: (...a: unknown[]) => getPreapproval(...a) }));

const searchAuthorizedPayments = vi.fn();
vi.mock("@/modules/billing/mercadopago/authorized-payments", async () => {
  const actual = await vi.importActual<typeof import("./authorized-payments")>("./authorized-payments");
  return { ...actual, searchAuthorizedPayments: (...a: unknown[]) => searchAuthorizedPayments(...a) };
});

const applyInstallment = vi.fn();
vi.mock("@/modules/billing/mercadopago/webhook-handler", () => ({ applyInstallment: (...a: unknown[]) => applyInstallment(...a) }));

vi.mock("@/modules/billing/mercadopago/client", () => ({ isMercadoPagoConfigured: () => true }));

const { reconcileMercadoPagoSubscriptions } = await import("./reconcile");

const NOW = new Date("2026-10-26T12:00:00Z");
const SUB = {
  businessId: "biz_1",
  planId: "plan_pack",
  status: "active",
  currentPeriodStart: new Date("2026-09-10T00:00:00Z"),
  currentPeriodEnd: new Date("2026-10-10T00:00:00Z"),
  providerSubscriptionId: "pre_1",
  planPriceId: "price_month",
  billingInterval: "month",
  pastDueSince: null,
};

beforeEach(() => {
  for (const m of [findMany, getSubscriptionWithPlan, assignSubscription, getPreapproval, searchAuthorizedPayments, applyInstallment]) m.mockReset();
  findMany.mockResolvedValue([{ businessId: "biz_1" }]);
  getSubscriptionWithPlan.mockResolvedValue(SUB);
  assignSubscription.mockResolvedValue({ ok: true });
  searchAuthorizedPayments.mockResolvedValue([]);
});

describe("reconcileMercadoPagoSubscriptions", () => {
  it("MP canceló (3 cuotas rechazadas) → canceled, conservando período y precio", async () => {
    getPreapproval.mockResolvedValue({ id: "pre_1", status: "cancelled", nextPaymentDate: null });
    await reconcileMercadoPagoSubscriptions(NOW);
    expect(assignSubscription).toHaveBeenCalledWith(
      "biz_1",
      expect.objectContaining({ status: "canceled", currentPeriodEnd: SUB.currentPeriodEnd, planPriceId: "price_month", mercadoPagoLastSyncedAt: NOW })
    );
  });

  it("aplica la última cuota resuelta con la misma regla que el webhook", async () => {
    getPreapproval.mockResolvedValue({ id: "pre_1", status: "authorized", nextPaymentDate: "2026-11-10T00:00:00Z" });
    const paid = { id: "ap_2", preapprovalId: "pre_1", status: "processed", paymentStatus: "approved", debitDate: new Date("2026-10-10T00:00:00Z") };
    searchAuthorizedPayments.mockResolvedValue([{ id: "ap_3", preapprovalId: "pre_1", status: "scheduled", paymentStatus: null, debitDate: new Date("2026-11-10T00:00:00Z") }, paid]);
    applyInstallment.mockResolvedValue({ handled: true, duplicate: false, action: "updated" });

    const result = await reconcileMercadoPagoSubscriptions(NOW);

    expect(applyInstallment).toHaveBeenCalledWith(SUB, paid, NOW);
    expect(result.updated).toBe(1);
  });

  it("sin cuota nueva: actualiza la próxima fecha y la sincronización (corta la inferencia de atraso)", async () => {
    getPreapproval.mockResolvedValue({ id: "pre_1", status: "authorized", nextPaymentDate: "2026-11-10T00:00:00Z" });
    await reconcileMercadoPagoSubscriptions(NOW);
    expect(assignSubscription).toHaveBeenCalledWith(
      "biz_1",
      expect.objectContaining({ status: "active", currentPeriodEnd: new Date("2026-11-10T00:00:00Z"), mercadoPagoLastSyncedAt: NOW })
    );
  });

  it("MP informa una fecha de cobro vencida y sin cuota que lo explique → past_due desde esa fecha", async () => {
    getPreapproval.mockResolvedValue({ id: "pre_1", status: "authorized", nextPaymentDate: "2026-10-15T00:00:00Z" });
    await reconcileMercadoPagoSubscriptions(NOW);
    expect(assignSubscription).toHaveBeenCalledWith(
      "biz_1",
      expect.objectContaining({ status: "past_due", pastDueSince: new Date("2026-10-15T00:00:00Z") })
    );
  });

  it("MP no informa fecha → nunca se marca atrasada por la fecha vieja de Nexo", async () => {
    getPreapproval.mockResolvedValue({ id: "pre_1", status: "authorized", nextPaymentDate: null });
    await reconcileMercadoPagoSubscriptions(NOW);
    expect(assignSubscription).toHaveBeenCalledWith("biz_1", expect.objectContaining({ status: "active" }));
  });

  it("un error en un negocio no corta a los demás", async () => {
    findMany.mockResolvedValue([{ businessId: "biz_1" }, { businessId: "biz_2" }]);
    getPreapproval.mockRejectedValueOnce(new Error("timeout")).mockResolvedValue({ id: "pre_1", status: "authorized", nextPaymentDate: "2026-11-10T00:00:00Z" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await reconcileMercadoPagoSubscriptions(NOW);
    expect(result).toMatchObject({ checked: 2, errors: 1 });
  });
});
