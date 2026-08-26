import { describe, expect, it, vi, beforeEach } from "vitest";

const preApprovalCreate = vi.fn();
const preApprovalGet = vi.fn();

vi.mock("mercadopago", () => ({
  PreApproval: function PreApproval() {
    return {
      create: (...args: unknown[]) => preApprovalCreate(...args),
      get: (...args: unknown[]) => preApprovalGet(...args),
    };
  },
}));

vi.mock("@/modules/billing/mercadopago/client", () => ({
  getMercadoPagoClient: vi.fn().mockReturnValue({}),
}));

const { createPreapproval, getPreapproval } = await import("./subscriptions");

beforeEach(() => {
  preApprovalCreate.mockReset();
  preApprovalGet.mockReset();
});

describe("createPreapproval", () => {
  it("manda preapproval_plan_id + card_token_id + status:authorized en el mismo POST (único flujo soportado para plan asociado)", async () => {
    preApprovalCreate.mockResolvedValue({ id: "preapproval_1", status: "authorized", external_reference: "biz_1", payer_email: "x@x.com" });

    const result = await createPreapproval({
      preapprovalPlanId: "mp_plan_1",
      payerEmail: "x@x.com",
      cardTokenId: "card_token_abc",
      externalReference: "biz_1",
    });

    expect(preApprovalCreate).toHaveBeenCalledWith({
      body: {
        preapproval_plan_id: "mp_plan_1",
        payer_email: "x@x.com",
        card_token_id: "card_token_abc",
        external_reference: "biz_1",
        status: "authorized",
      },
    });
    expect(result.id).toBe("preapproval_1");
    expect(result.status).toBe("authorized");
  });

  it("lanza si Mercado Pago responde sin id", async () => {
    preApprovalCreate.mockResolvedValue({ status: "authorized" });
    await expect(
      createPreapproval({ preapprovalPlanId: "mp_plan_1", payerEmail: "x@x.com", cardTokenId: "t", externalReference: "biz_1" })
    ).rejects.toThrow("Mercado Pago no devolvió un id de preapproval.");
  });
});

describe("getPreapproval", () => {
  it("consulta por id y devuelve el snapshot con external_reference/next_payment_date", async () => {
    preApprovalGet.mockResolvedValue({
      id: "preapproval_1",
      status: "paused",
      external_reference: "biz_1",
      next_payment_date: "2026-09-25T00:00:00.000Z",
    });

    const result = await getPreapproval("preapproval_1");

    expect(preApprovalGet).toHaveBeenCalledWith({ id: "preapproval_1" });
    expect(result).toEqual({
      id: "preapproval_1",
      status: "paused",
      externalReference: "biz_1",
      payerEmail: null,
      nextPaymentDate: "2026-09-25T00:00:00.000Z",
    });
  });
});
