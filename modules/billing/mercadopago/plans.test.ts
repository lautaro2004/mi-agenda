import { describe, expect, it, vi, beforeEach } from "vitest";

const preApprovalPlanCreate = vi.fn();
const preApprovalPlanGet = vi.fn();
const preApprovalPlanUpdate = vi.fn();

vi.mock("mercadopago", () => ({
  PreApprovalPlan: function PreApprovalPlan() {
    return {
      create: (...args: unknown[]) => preApprovalPlanCreate(...args),
      get: (...args: unknown[]) => preApprovalPlanGet(...args),
      update: (...args: unknown[]) => preApprovalPlanUpdate(...args),
    };
  },
}));

vi.mock("@/modules/billing/mercadopago/client", () => ({
  getMercadoPagoClient: vi.fn().mockReturnValue({}),
}));

const { createPreapprovalPlan, getPreapprovalPlan, updatePreapprovalPlanMetadata } = await import("./plans");

beforeEach(() => {
  preApprovalPlanCreate.mockReset();
  preApprovalPlanGet.mockReset();
  preApprovalPlanUpdate.mockReset();
  process.env.BETTER_AUTH_URL = "https://nexo.test";
});

describe("createPreapprovalPlan", () => {
  it("manda reason/auto_recurring mensual con el precio y moneda del plan, y back_url a /dashboard/suscripcion", async () => {
    preApprovalPlanCreate.mockResolvedValue({
      id: "mp_plan_1",
      status: "active",
      reason: "Esencial",
      auto_recurring: { transaction_amount: 12000, currency_id: "ARS" },
    });

    const result = await createPreapprovalPlan({ name: "Esencial", monthlyPrice: 12000, currency: "ARS" });

    expect(preApprovalPlanCreate).toHaveBeenCalledWith({
      body: {
        reason: "Esencial",
        back_url: "https://nexo.test/dashboard/suscripcion",
        auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: 12000, currency_id: "ARS" },
      },
    });
    expect(result).toEqual({ id: "mp_plan_1", status: "active", reason: "Esencial", transactionAmount: 12000, currencyId: "ARS" });
  });

  it("lanza si Mercado Pago responde sin id", async () => {
    preApprovalPlanCreate.mockResolvedValue({ status: "active" });
    await expect(createPreapprovalPlan({ name: "Esencial", monthlyPrice: 12000, currency: "ARS" })).rejects.toThrow(
      "Mercado Pago no devolvió un id de preapproval_plan."
    );
  });
});

describe("getPreapprovalPlan", () => {
  it("consulta el preapproval_plan por id y devuelve su snapshot", async () => {
    preApprovalPlanGet.mockResolvedValue({
      id: "mp_plan_1",
      status: "active",
      reason: "Esencial",
      auto_recurring: { transaction_amount: 12000, currency_id: "ARS" },
    });

    const result = await getPreapprovalPlan("mp_plan_1");

    expect(preApprovalPlanGet).toHaveBeenCalledWith({ preApprovalPlanId: "mp_plan_1" });
    expect(result.transactionAmount).toBe(12000);
  });
});

describe("updatePreapprovalPlanMetadata", () => {
  it("solo actualiza reason/status — nunca auto_recurring/transaction_amount", async () => {
    preApprovalPlanUpdate.mockResolvedValue({
      id: "mp_plan_1",
      status: "inactive",
      reason: "Esencial (renombrado)",
      auto_recurring: { transaction_amount: 12000, currency_id: "ARS" },
    });

    await updatePreapprovalPlanMetadata("mp_plan_1", { name: "Esencial (renombrado)", active: false });

    expect(preApprovalPlanUpdate).toHaveBeenCalledWith({
      id: "mp_plan_1",
      updatePreApprovalPlanRequest: { reason: "Esencial (renombrado)", status: "cancelled" },
    });
  });
});
