import { describe, expect, it, vi, beforeEach } from "vitest";

const recordWebhookEventOnce = vi.fn();
const getPreapproval = vi.fn();
const getSubscriptionWithPlan = vi.fn();
const assignSubscription = vi.fn();
const getSubscriptionByPreapprovalId = vi.fn();
const getAuthorizedPayment = vi.fn();

vi.mock("@/modules/billing/mercadopago/webhook-events", () => ({
  recordWebhookEventOnce: (...args: unknown[]) => recordWebhookEventOnce(...args),
}));

vi.mock("@/modules/billing/mercadopago/subscriptions", () => ({
  getPreapproval: (...args: unknown[]) => getPreapproval(...args),
}));

vi.mock("@/modules/billing/subscription", () => ({
  getSubscriptionWithPlan: (...args: unknown[]) => getSubscriptionWithPlan(...args),
  assignSubscription: (...args: unknown[]) => assignSubscription(...args),
  getSubscriptionByPreapprovalId: (...args: unknown[]) => getSubscriptionByPreapprovalId(...args),
}));

vi.mock("@/modules/billing/mercadopago/authorized-payments", async () => {
  const actual = await vi.importActual<typeof import("./authorized-payments")>("./authorized-payments");
  return {
    classifyInstallment: actual.classifyInstallment,
    getAuthorizedPayment: (...args: unknown[]) => getAuthorizedPayment(...args),
  };
});

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
  getSubscriptionByPreapprovalId.mockReset();
  getAuthorizedPayment.mockReset();
  recordWebhookEventOnce.mockResolvedValue(true);
});

describe("processMercadoPagoWebhook", () => {
  it("una notificación duplicada (mismo id) no se reprocesa", async () => {
    recordWebhookEventOnce.mockResolvedValue(false);

    const result = await processMercadoPagoWebhook(NOTIFICATION);

    expect(result).toEqual({ handled: true, duplicate: true });
    expect(getPreapproval).not.toHaveBeenCalled();
  });

  it("un topic desconocido se reconoce sin procesar", async () => {
    const result = await processMercadoPagoWebhook({ ...NOTIFICATION, type: "payment" });

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

  it("notificación de un preapproval que ya no es el vigente → no toca la suscripción", async () => {
    getPreapproval.mockResolvedValue({ id: "preapproval_viejo", status: "cancelled", externalReference: "biz_1", nextPaymentDate: null });
    getSubscriptionWithPlan.mockResolvedValue({ ...EXISTING_SUB, providerSubscriptionId: "preapproval_nuevo" });

    const result = await processMercadoPagoWebhook({ ...NOTIFICATION, data: { id: "preapproval_viejo" } });

    expect(result).toEqual({ handled: true, duplicate: false, action: "skipped_stale" });
    expect(assignSubscription).not.toHaveBeenCalled();
  });

  it("preapproval 'authorized' con un atraso registrado sigue past_due (solo una cuota aprobada lo limpia)", async () => {
    const since = new Date("2026-08-20T00:00:00Z");
    getPreapproval.mockResolvedValue({ id: "preapproval_1", status: "authorized", externalReference: "biz_1", nextPaymentDate: null });
    getSubscriptionWithPlan.mockResolvedValue({ ...EXISTING_SUB, providerSubscriptionId: "preapproval_1", pastDueSince: since });
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });

    await processMercadoPagoWebhook(NOTIFICATION);

    expect(assignSubscription).toHaveBeenCalledWith("biz_1", expect.objectContaining({ status: "past_due", pastDueSince: since }));
  });
});

describe("cuotas (subscription_authorized_payment)", () => {
  const PAYMENT_NOTIFICATION = { id: "notif_p1", type: "subscription_authorized_payment", data: { id: "ap_1" } };
  const SUB = {
    businessId: "biz_1",
    planId: "plan_pack",
    status: "active",
    currentPeriodStart: new Date("2026-08-01T00:00:00Z"),
    currentPeriodEnd: new Date("2026-09-01T00:00:00Z"),
    providerSubscriptionId: "preapproval_1",
    mercadoPagoStatus: "authorized",
    planPriceId: "price_month",
    billingInterval: "month",
    pastDueSince: null,
  };

  it("cuota rechazada (en reintentos) → past_due y pastDueSince se fija", async () => {
    getAuthorizedPayment.mockResolvedValue({ id: "ap_1", preapprovalId: "preapproval_1", status: "recycling", paymentStatus: "rejected", debitDate: new Date("2026-09-01T00:00:00Z") });
    getSubscriptionByPreapprovalId.mockResolvedValue(SUB);
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });

    await processMercadoPagoWebhook(PAYMENT_NOTIFICATION);

    expect(assignSubscription).toHaveBeenCalledWith(
      "biz_1",
      expect.objectContaining({ status: "past_due", pastDueSince: expect.any(Date), planPriceId: "price_month", billingInterval: "month" })
    );
  });

  it("un reintento rechazado más NO reinicia la gracia", async () => {
    const since = new Date("2026-09-01T10:00:00Z");
    getAuthorizedPayment.mockResolvedValue({ id: "ap_1", preapprovalId: "preapproval_1", status: "recycling", paymentStatus: "rejected", debitDate: new Date("2026-09-01T00:00:00Z") });
    getSubscriptionByPreapprovalId.mockResolvedValue({ ...SUB, status: "past_due", pastDueSince: since });
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });

    await processMercadoPagoWebhook(PAYMENT_NOTIFICATION);

    expect(assignSubscription).toHaveBeenCalledWith("biz_1", expect.objectContaining({ pastDueSince: since }));
  });

  it("cuota aprobada → active, limpia el atraso y avanza el período", async () => {
    getAuthorizedPayment.mockResolvedValue({ id: "ap_1", preapprovalId: "preapproval_1", status: "processed", paymentStatus: "approved", debitDate: new Date("2026-09-03T00:00:00Z") });
    getSubscriptionByPreapprovalId.mockResolvedValue({ ...SUB, status: "past_due", pastDueSince: new Date("2026-09-01T10:00:00Z") });
    getPreapproval.mockResolvedValue({ id: "preapproval_1", status: "authorized", externalReference: "biz_1", nextPaymentDate: "2026-10-03T00:00:00.000Z" });
    assignSubscription.mockResolvedValue({ ok: true, subscription: {} });

    await processMercadoPagoWebhook(PAYMENT_NOTIFICATION);

    const input = assignSubscription.mock.calls[0][1];
    expect(input).toMatchObject({ status: "active", currentPeriodEnd: new Date("2026-10-03T00:00:00.000Z") });
    expect(input.pastDueSince).toBeUndefined();
  });

  it("una cuota vieja (de un período anterior) no hace retroceder el estado", async () => {
    getAuthorizedPayment.mockResolvedValue({ id: "ap_0", preapprovalId: "preapproval_1", status: "processed", paymentStatus: "rejected", debitDate: new Date("2026-07-01T00:00:00Z") });
    getSubscriptionByPreapprovalId.mockResolvedValue(SUB);

    const result = await processMercadoPagoWebhook(PAYMENT_NOTIFICATION);

    expect(result).toEqual({ handled: true, duplicate: false, action: "skipped_stale" });
    expect(assignSubscription).not.toHaveBeenCalled();
  });

  it("cuota programada o en proceso → nada que reflejar", async () => {
    getAuthorizedPayment.mockResolvedValue({ id: "ap_1", preapprovalId: "preapproval_1", status: "scheduled", paymentStatus: null, debitDate: null });

    const result = await processMercadoPagoWebhook(PAYMENT_NOTIFICATION);

    expect(result).toEqual({ handled: true, duplicate: false, action: "acknowledged" });
    expect(assignSubscription).not.toHaveBeenCalled();
  });

  it("si falla la relectura de la cuota, handled:false para que MP reintente", async () => {
    getAuthorizedPayment.mockRejectedValue(new Error("timeout"));
    const result = await processMercadoPagoWebhook(PAYMENT_NOTIFICATION);
    expect(result).toMatchObject({ handled: false });
  });
});
