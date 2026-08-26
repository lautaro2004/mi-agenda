import { describe, expect, it, vi, beforeEach } from "vitest";

const getPlanById = vi.fn();
const getSubscriptionWithPlan = vi.fn();
const assignSubscription = vi.fn();
const createPreapproval = vi.fn();

vi.mock("@/modules/billing/subscription", () => ({
  getPlanById: (...args: unknown[]) => getPlanById(...args),
  getSubscriptionWithPlan: (...args: unknown[]) => getSubscriptionWithPlan(...args),
  assignSubscription: (...args: unknown[]) => assignSubscription(...args),
}));

vi.mock("@/modules/billing/mercadopago/subscriptions", () => ({
  createPreapproval: (...args: unknown[]) => createPreapproval(...args),
}));

const { createSubscriptionCheckout } = await import("./checkout");

const PLAN_ESENCIAL = {
  id: "plan_esencial",
  name: "Esencial",
  monthlyPrice: 12000,
  currency: "ARS",
  active: true,
  mercadoPagoPlanId: "mp_plan_1",
};

const INPUT = {
  businessId: "biz_1",
  planId: "plan_esencial",
  payerEmail: "dueno@negocio.com",
  cardTokenId: "card_token_abc",
};

beforeEach(() => {
  getPlanById.mockReset();
  getSubscriptionWithPlan.mockReset();
  assignSubscription.mockReset();
  createPreapproval.mockReset();
  getSubscriptionWithPlan.mockResolvedValue(null);
});

describe("createSubscriptionCheckout", () => {
  it("plan_not_found si el plan no existe", async () => {
    getPlanById.mockResolvedValue(null);
    const result = await createSubscriptionCheckout(INPUT);
    expect(result).toEqual({ ok: false, error: "plan_not_found" });
    expect(createPreapproval).not.toHaveBeenCalled();
  });

  it("plan_inactive si el plan está desactivado", async () => {
    getPlanById.mockResolvedValue({ ...PLAN_ESENCIAL, active: false });
    const result = await createSubscriptionCheckout(INPUT);
    expect(result).toEqual({ ok: false, error: "plan_inactive" });
  });

  it("plan_not_synced si el plan todavía no tiene mercadoPagoPlanId", async () => {
    getPlanById.mockResolvedValue({ ...PLAN_ESENCIAL, mercadoPagoPlanId: null });
    const result = await createSubscriptionCheckout(INPUT);
    expect(result).toEqual({ ok: false, error: "plan_not_synced" });
  });

  it("already_subscribed si el negocio ya tiene una suscripción de Mercado Pago activa", async () => {
    getPlanById.mockResolvedValue(PLAN_ESENCIAL);
    getSubscriptionWithPlan.mockResolvedValue({ provider: "mercadopago", status: "active" });
    const result = await createSubscriptionCheckout(INPUT);
    expect(result).toEqual({ ok: false, error: "already_subscribed" });
    expect(createPreapproval).not.toHaveBeenCalled();
  });

  it("permite contratar si la suscripción existente NO es de Mercado Pago (ej. trial/benefit)", async () => {
    getPlanById.mockResolvedValue(PLAN_ESENCIAL);
    getSubscriptionWithPlan.mockResolvedValue({ provider: "manual", status: "trialing", planId: "plan_gratis" });
    createPreapproval.mockResolvedValue({ id: "preapproval_1", status: "authorized" });
    assignSubscription.mockResolvedValue({ ok: true, subscription: { id: "sub_1", status: "active" } });

    const result = await createSubscriptionCheckout(INPUT);
    expect(result.ok).toBe(true);
  });

  it("usa businessId como external_reference al crear el preapproval", async () => {
    getPlanById.mockResolvedValue(PLAN_ESENCIAL);
    createPreapproval.mockResolvedValue({ id: "preapproval_1", status: "authorized" });
    assignSubscription.mockResolvedValue({ ok: true, subscription: { id: "sub_1", status: "active" } });

    await createSubscriptionCheckout(INPUT);

    expect(createPreapproval).toHaveBeenCalledWith({
      preapprovalPlanId: "mp_plan_1",
      payerEmail: "dueno@negocio.com",
      cardTokenId: "card_token_abc",
      externalReference: "biz_1",
    });
  });

  it("si Mercado Pago confirma 'authorized', activa el plan vía assignSubscription con provider mercadopago", async () => {
    getPlanById.mockResolvedValue(PLAN_ESENCIAL);
    createPreapproval.mockResolvedValue({ id: "preapproval_1", status: "authorized" });
    assignSubscription.mockResolvedValue({ ok: true, subscription: { id: "sub_1", status: "active" } });

    const result = await createSubscriptionCheckout(INPUT);

    expect(assignSubscription).toHaveBeenCalledWith(
      "biz_1",
      expect.objectContaining({
        planId: "plan_esencial",
        status: "active",
        provider: "mercadopago",
        providerSubscriptionId: "preapproval_1",
        mercadoPagoStatus: "authorized",
      })
    );
    expect(result.ok).toBe(true);
  });

  it("si Mercado Pago devuelve un estado sin mapping (ej. 'pending'), NO activa el plan todavía", async () => {
    getPlanById.mockResolvedValue(PLAN_ESENCIAL);
    createPreapproval.mockResolvedValue({ id: "preapproval_1", status: "pending" });

    const result = await createSubscriptionCheckout(INPUT);

    expect(result).toEqual({
      ok: false,
      error: "mercadopago_error",
      message: expect.stringContaining("pending"),
    });
    expect(assignSubscription).not.toHaveBeenCalled();
  });

  it("mercadopago_error si createPreapproval lanza (ej. tarjeta rechazada)", async () => {
    getPlanById.mockResolvedValue(PLAN_ESENCIAL);
    createPreapproval.mockRejectedValue(new Error("cc_rejected_insufficient_amount"));

    const result = await createSubscriptionCheckout(INPUT);

    expect(result).toEqual({ ok: false, error: "mercadopago_error", message: "cc_rejected_insufficient_amount" });
    expect(assignSubscription).not.toHaveBeenCalled();
  });
});
