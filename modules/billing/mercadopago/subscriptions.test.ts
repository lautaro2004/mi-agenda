import { describe, expect, it, vi, beforeEach } from "vitest";

const preApprovalCreate = vi.fn();
const preApprovalGet = vi.fn();
const preApprovalUpdate = vi.fn();

vi.mock("mercadopago", () => ({
  PreApproval: function PreApproval() {
    return {
      create: (...args: unknown[]) => preApprovalCreate(...args),
      get: (...args: unknown[]) => preApprovalGet(...args),
      update: (...args: unknown[]) => preApprovalUpdate(...args),
    };
  },
}));

vi.mock("@/modules/billing/mercadopago/client", () => ({
  getMercadoPagoClient: vi.fn().mockReturnValue({}),
}));

const { createPreapproval, getPreapproval, cancelPreapproval } = await import("./subscriptions");

let consoleLogSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  preApprovalCreate.mockReset();
  preApprovalGet.mockReset();
  preApprovalUpdate.mockReset();
  consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("createPreapproval", () => {
  // Shape verificada campo por campo contra la referencia oficial vigente de
  // Mercado Pago para "suscripción con plan asociado" (ver comentario en
  // subscriptions.ts): exactamente estos 5 campos, ninguno de más
  // (auto_recurring/reason/back_url quedan afuera a propósito — son
  // opcionales o redundantes cuando ya hay preapproval_plan_id), status
  // SIEMPRE "authorized" (única forma soportada para este flujo).
  it("manda EXACTAMENTE preapproval_plan_id + payer_email + card_token_id + external_reference + status:authorized, sin campos extra", async () => {
    preApprovalCreate.mockResolvedValue({ id: "preapproval_1", status: "authorized", external_reference: "biz_1", payer_email: "x@x.com" });

    const result = await createPreapproval({
      preapprovalPlanId: "mp_plan_1",
      payerEmail: "x@x.com",
      cardTokenId: "card_token_abc",
      externalReference: "biz_1",
    });

    expect(preApprovalCreate).toHaveBeenCalledTimes(1);
    const [callArg] = preApprovalCreate.mock.calls[0] as [{ body: Record<string, unknown> }];
    expect(Object.keys(callArg.body).sort()).toEqual(
      ["card_token_id", "external_reference", "payer_email", "preapproval_plan_id", "status"].sort()
    );
    expect(callArg.body).toEqual({
      preapproval_plan_id: "mp_plan_1",
      payer_email: "x@x.com",
      card_token_id: "card_token_abc",
      external_reference: "biz_1",
      status: "authorized",
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

  it("el diagnóstico temporal del request nunca loguea el card_token_id ni el payer_email completos", async () => {
    preApprovalCreate.mockResolvedValue({ id: "preapproval_1", status: "authorized" });

    await createPreapproval({
      preapprovalPlanId: "mp_plan_1",
      payerEmail: "secreto@negocio.com",
      cardTokenId: "card_token_super_secreto_abc123",
      externalReference: "biz_1",
    });

    const serialized = JSON.stringify(consoleLogSpy.mock.calls);
    expect(serialized).toContain("preapproval_plan_id");
    expect(serialized).not.toContain("card_token_super_secreto_abc123");
    expect(serialized).not.toContain("secreto@negocio.com");
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

describe("cancelPreapproval", () => {
  it("manda PUT /preapproval/:id con status:cancelled — la única transición definitiva", async () => {
    preApprovalUpdate.mockResolvedValue({ id: "preapproval_1", status: "cancelled" });

    const result = await cancelPreapproval("preapproval_1");

    expect(preApprovalUpdate).toHaveBeenCalledWith({ id: "preapproval_1", body: { status: "cancelled" } });
    expect(result.status).toBe("cancelled");
  });

  // PreApprovalUpdateResponse tipa external_reference/next_payment_date
  // como number (a diferencia de create/get, que los tipan string) — ver el
  // comentario en toSnapshot(). Confirma que no explota ni pierde el dato.
  it("normaliza external_reference/next_payment_date a string aunque Mercado Pago los devuelva como number", async () => {
    preApprovalUpdate.mockResolvedValue({
      id: "preapproval_1",
      status: "cancelled",
      external_reference: 123456,
      next_payment_date: 1735689600000,
    });

    const result = await cancelPreapproval("preapproval_1");

    expect(result.externalReference).toBe("123456");
    expect(result.nextPaymentDate).toBe("1735689600000");
  });
});
