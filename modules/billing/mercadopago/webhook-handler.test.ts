import { describe, expect, it, vi, beforeEach } from "vitest";

const recordWebhookEventOnce = vi.fn();
const getPreapproval = vi.fn();
const getSubscriptionWithPlan = vi.fn();
const assignSubscription = vi.fn();

vi.mock("@/modules/billing/mercadopago/webhook-events", () => ({
  recordWebhookEventOnce: (...args: unknown[]) => recordWebhookEventOnce(...args),
}));

vi.mock("@/modules/billing/mercadopago/subscriptions", () => ({
  getPreapproval: (...args: unknown[]) => getPreapproval(...args),
}));

vi.mock("@/modules/billing/subscription", () => ({
  getSubscriptionWithPlan: (...args: unknown[]) => getSubscriptionWithPlan(...args),
  assignSubscription: (...args: unknown[]) => assignSubscription(...args),
}));

const { processMercadoPagoWebhook } = await import("./webhook-handler");

const NOTIFICATION = { id: "notif_1", type: "subscription_preapproval", data: { id: "preapproval_1" } };

const EXISTING_SUB = {
  planId: "plan_esencial",
  currentPeriodStart: new Date("2026-08-01"),
  currentPeriodEnd: new Date("2026-09-01"),
};

beforeEach(() => {
  recordWebhookEventOnce.mockReset();
  getPreapproval.mockReset();
  getSubscriptionWithPlan.mockReset();
  assignSubscription.mockReset();
  recordWebhookEventOnce.mockResolvedValue(true);
});

describe("processMercadoPagoWebhook", () => {
  it("una notificación duplicada (mismo id) no se reprocesa", async () => {
    recordWebhookEventOnce.mockResolvedValue(false);

    const result = await processMercadoPagoWebhook(NOTIFICATION);

    expect(result).toEqual({ handled: true, duplicate: true });
    expect(getPreapproval).not.toHaveBeenCalled();
  });

  it("un topic distinto de subscription_preapproval se reconoce sin procesar (ej. subscription_authorized_payment)", async () => {
    const result = await processMercadoPagoWebhook({ ...NOTIFICATION, type: "subscription_authorized_payment" });

    expect(result).toEqual({ handled: true, duplicate: false, action: "acknowledged" });
    expect(getPreapproval).not.toHaveBeenCalled();
  });

  it("nunca confía en el payload: siempre relee el preapproval real antes de actualizar", async () => {
    getPreapproval.mockResolvedValue({ id: "preapproval_1", status: "authorized", externalReference: "biz_1", nextPaymentDate: null });
    getSubscriptionWithPlan.mockResolvedValue(EXISTING_SUB);
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });

    await processMercadoPagoWebhook(NOTIFICATION);

    expect(getPreapproval).toHaveBeenCalledWith("preapproval_1");
  });

  it("status 'pending' no tiene mapping -> no toca la Subscription", async () => {
    getPreapproval.mockResolvedValue({ id: "preapproval_1", status: "pending", externalReference: "biz_1", nextPaymentDate: null });

    const result = await processMercadoPagoWebhook(NOTIFICATION);

    expect(result).toEqual({ handled: true, duplicate: false, action: "skipped_pending" });
    expect(assignSubscription).not.toHaveBeenCalled();
  });

  it("si no hay Subscription todavía para ese external_reference, no falla — solo lo omite", async () => {
    getPreapproval.mockResolvedValue({ id: "preapproval_1", status: "authorized", externalReference: "biz_sin_sub", nextPaymentDate: null });
    getSubscriptionWithPlan.mockResolvedValue(null);

    const result = await processMercadoPagoWebhook(NOTIFICATION);

    expect(result).toEqual({ handled: true, duplicate: false, action: "skipped_no_subscription" });
    expect(assignSubscription).not.toHaveBeenCalled();
  });

  it("authorized -> active, actualiza la Subscription existente por external_reference (businessId)", async () => {
    getPreapproval.mockResolvedValue({ id: "preapproval_1", status: "authorized", externalReference: "biz_1", nextPaymentDate: "2026-09-25T00:00:00.000Z" });
    getSubscriptionWithPlan.mockResolvedValue(EXISTING_SUB);
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });

    const result = await processMercadoPagoWebhook(NOTIFICATION);

    expect(assignSubscription).toHaveBeenCalledWith("biz_1", {
      planId: "plan_esencial",
      status: "active",
      currentPeriodStart: EXISTING_SUB.currentPeriodStart,
      currentPeriodEnd: new Date("2026-09-25T00:00:00.000Z"),
      provider: "mercadopago",
      providerSubscriptionId: "preapproval_1",
      mercadoPagoStatus: "authorized",
      mercadoPagoLastSyncedAt: expect.any(Date),
    });
    expect(result).toEqual({ handled: true, duplicate: false, action: "updated" });
  });

  it("paused -> past_due (pago recurrente fallido, no es una baja definitiva)", async () => {
    getPreapproval.mockResolvedValue({ id: "preapproval_1", status: "paused", externalReference: "biz_1", nextPaymentDate: null });
    getSubscriptionWithPlan.mockResolvedValue(EXISTING_SUB);
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });

    await processMercadoPagoWebhook(NOTIFICATION);

    expect(assignSubscription).toHaveBeenCalledWith("biz_1", expect.objectContaining({ status: "past_due" }));
  });

  it("cancelled -> canceled (baja definitiva)", async () => {
    getPreapproval.mockResolvedValue({ id: "preapproval_1", status: "cancelled", externalReference: "biz_1", nextPaymentDate: null });
    getSubscriptionWithPlan.mockResolvedValue(EXISTING_SUB);
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });

    await processMercadoPagoWebhook(NOTIFICATION);

    expect(assignSubscription).toHaveBeenCalledWith("biz_1", expect.objectContaining({ status: "canceled" }));
  });

  it("handled:false si falla la relectura del preapproval (para que Mercado Pago reintente)", async () => {
    getPreapproval.mockRejectedValue(new Error("timeout"));

    const result = await processMercadoPagoWebhook(NOTIFICATION);

    expect(result.handled).toBe(false);
  });

  it("handled:false si el preapproval no tiene external_reference", async () => {
    getPreapproval.mockResolvedValue({ id: "preapproval_1", status: "authorized", externalReference: null, nextPaymentDate: null });

    const result = await processMercadoPagoWebhook(NOTIFICATION);

    expect(result.handled).toBe(false);
  });
});
