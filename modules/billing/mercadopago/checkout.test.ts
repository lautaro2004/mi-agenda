import { describe, expect, it, vi, beforeEach } from "vitest";
import { MercadoPagoError } from "mercadopago";

import { MercadoPagoNotConfiguredError } from "@/modules/billing/mercadopago/client";

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

const SENSITIVE_STRINGS = ["TEST-8376092370977313", "Bearer ", "ACCESS_TOKEN", "WEBHOOK_SECRET", "card_token_abc"];

function assertNoSensitiveLeak(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const needle of SENSITIVE_STRINGS) {
    expect(serialized).not.toContain(needle);
  }
}

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  getPlanById.mockReset();
  getSubscriptionWithPlan.mockReset();
  assignSubscription.mockReset();
  createPreapproval.mockReset();
  getSubscriptionWithPlan.mockResolvedValue(null);
  getPlanById.mockResolvedValue(PLAN_ESENCIAL);
  consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createSubscriptionCheckout — validaciones de Nexo", () => {
  it("PLAN_NOT_FOUND si el plan no existe", async () => {
    getPlanById.mockResolvedValue(null);
    const result = await createSubscriptionCheckout(INPUT);
    expect(result).toEqual({ ok: false, error: { code: "PLAN_NOT_FOUND", message: "El plan elegido no existe.", detail: undefined } });
    expect(createPreapproval).not.toHaveBeenCalled();
  });

  it("PLAN_INACTIVE si el plan está desactivado", async () => {
    getPlanById.mockResolvedValue({ ...PLAN_ESENCIAL, active: false });
    const result = await createSubscriptionCheckout(INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("PLAN_INACTIVE");
  });

  it("PLAN_NOT_SYNCED si el plan todavía no tiene mercadoPagoPlanId", async () => {
    getPlanById.mockResolvedValue({ ...PLAN_ESENCIAL, mercadoPagoPlanId: null });
    const result = await createSubscriptionCheckout(INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("PLAN_NOT_SYNCED");
  });

  it("ALREADY_SUBSCRIBED si el negocio ya tiene una suscripción de Mercado Pago activa", async () => {
    getSubscriptionWithPlan.mockResolvedValue({ provider: "mercadopago", status: "active" });
    const result = await createSubscriptionCheckout(INPUT);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("ALREADY_SUBSCRIBED");
    expect(createPreapproval).not.toHaveBeenCalled();
  });

  it("permite contratar si la suscripción existente NO es de Mercado Pago (ej. trial/benefit)", async () => {
    getSubscriptionWithPlan.mockResolvedValue({ provider: "manual", status: "trialing", planId: "plan_gratis" });
    createPreapproval.mockResolvedValue({ id: "preapproval_1", status: "authorized" });
    assignSubscription.mockResolvedValue({ ok: true, subscription: { id: "sub_1", status: "active" } });

    const result = await createSubscriptionCheckout(INPUT);
    expect(result.ok).toBe(true);
  });
});

describe("createSubscriptionCheckout — contratación exitosa", () => {
  it("usa businessId como external_reference al crear el preapproval", async () => {
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
});

describe("createSubscriptionCheckout — Mercado Pago devuelve un estado sin mapping", () => {
  it("MERCADOPAGO_UNEXPECTED_STATUS si el status no tiene mapping interno (ej. 'pending'), NO activa el plan", async () => {
    createPreapproval.mockResolvedValue({ id: "preapproval_1", status: "pending" });

    const result = await createSubscriptionCheckout(INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("MERCADOPAGO_UNEXPECTED_STATUS");
    expect(result.error.technicalCode).toBe("pending");
    expect(assignSubscription).not.toHaveBeenCalled();
  });
});

describe("createSubscriptionCheckout — error de Mercado Pago con cause", () => {
  it("usa el code de la primera cause para dar un mensaje entendible y un technicalCode", async () => {
    const mpError = new MercadoPagoError({
      status: 400,
      error: "bad_request",
      message: "Invalid card token",
      cause: [{ code: "cc_rejected_insufficient_amount", description: "Fondos insuficientes" }],
    });
    createPreapproval.mockRejectedValue(mpError);

    const result = await createSubscriptionCheckout(INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toEqual({
      code: "MERCADOPAGO_CHECKOUT_ERROR",
      message: "Mercado Pago rechazó la suscripción.",
      detail: "La tarjeta no tiene fondos suficientes.",
      technicalCode: "cc_rejected_insufficient_amount",
    });
    expect(assignSubscription).not.toHaveBeenCalled();
  });

  it("si el code de la cause no está en la lista conocida, usa la description que manda Mercado Pago", async () => {
    const mpError = new MercadoPagoError({
      status: 400,
      error: "bad_request",
      message: "algo",
      cause: [{ code: 2034, description: "El token de la tarjeta no existe o expiró" }],
    });
    createPreapproval.mockRejectedValue(mpError);

    const result = await createSubscriptionCheckout(INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.detail).toBe("El token de la tarjeta no existe o expiró");
    expect(result.error.technicalCode).toBe("2034");
  });

  it("loguea en servidor status/error/causes/message (nunca credenciales ni el card token)", async () => {
    const mpError = new MercadoPagoError({
      status: 400,
      error: "bad_request",
      message: "Invalid card token",
      cause: [{ code: "cc_rejected_insufficient_amount", description: "Fondos insuficientes" }],
    });
    createPreapproval.mockRejectedValue(mpError);

    await createSubscriptionCheckout(INPUT);

    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedArgs: unknown[] = consoleErrorSpy.mock.calls.flat();
    assertNoSensitiveLeak(loggedArgs);
    const loggedDetail = loggedArgs.find(
      (arg: unknown): arg is Record<string, unknown> => typeof arg === "object" && arg !== null && "httpStatus" in arg
    );
    expect(loggedDetail).toBeDefined();
    expect(loggedDetail).toMatchObject({ httpStatus: 400, mpErrorSlug: "bad_request" });
  });
});

describe("createSubscriptionCheckout — error de Mercado Pago SIN cause", () => {
  it("cae a un detail genérico y usa el slug de error como technicalCode", async () => {
    const mpError = new MercadoPagoError({ status: 401, error: "unauthorized", message: "invalid access token" });
    createPreapproval.mockRejectedValue(mpError);

    const result = await createSubscriptionCheckout(INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toEqual({
      code: "MERCADOPAGO_CHECKOUT_ERROR",
      message: "Mercado Pago rechazó la suscripción.",
      detail: "Mercado Pago rechazó la operación.",
      technicalCode: "unauthorized",
    });
  });

  it("reproduce el error real observado en sandbox: 404 'Card token service not found' sin cause ni slug — cae al status HTTP como technicalCode", async () => {
    // Este es EXACTAMENTE lo que devolvió Mercado Pago al probar la
    // integración con un card token real contra /preapproval (ver reporte
    // de esta fase): {"message":"Card token service not found","status":404},
    // sin "error" ni "cause". No es un rechazo de tarjeta (pasa igual con
    // tarjetas de prueba que deberían aprobarse) — es un error propio de
    // Mercado Pago en ese endpoint.
    const mpError = new MercadoPagoError({ status: 404, message: "Card token service not found" });
    createPreapproval.mockRejectedValue(mpError);

    const result = await createSubscriptionCheckout(INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toEqual({
      code: "MERCADOPAGO_CHECKOUT_ERROR",
      message: "Mercado Pago rechazó la suscripción.",
      detail: "Mercado Pago rechazó la operación.",
      technicalCode: "404",
    });
  });

  it("un Error genérico (no MercadoPagoError) también cae en MERCADOPAGO_CHECKOUT_ERROR con detail genérico", async () => {
    createPreapproval.mockRejectedValue(new Error("network timeout"));

    const result = await createSubscriptionCheckout(INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error).toEqual({
      code: "MERCADOPAGO_CHECKOUT_ERROR",
      message: "Mercado Pago rechazó la suscripción.",
      detail: "No pudimos completar la operación con Mercado Pago.",
      technicalCode: undefined,
    });
  });
});

describe("createSubscriptionCheckout — error de configuración de Nexo", () => {
  it("MERCADOPAGO_NOT_CONFIGURED si falta el access token (MercadoPagoNotConfiguredError), no un rechazo de Mercado Pago", async () => {
    createPreapproval.mockRejectedValue(new MercadoPagoNotConfiguredError());

    const result = await createSubscriptionCheckout(INPUT);

    expect(result).toEqual({
      ok: false,
      error: { code: "MERCADOPAGO_NOT_CONFIGURED", message: "La contratación online todavía no está configurada.", detail: undefined },
    });
    assertNoSensitiveLeak(result);
  });

  it("NEXO_ACTIVATION_ERROR si Mercado Pago autorizó pero assignSubscription falla del lado de Nexo", async () => {
    createPreapproval.mockResolvedValue({ id: "preapproval_1", status: "authorized" });
    assignSubscription.mockResolvedValue({ ok: false, error: "plan_inactive" });

    const result = await createSubscriptionCheckout(INPUT);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected failure");
    expect(result.error.code).toBe("NEXO_ACTIVATION_ERROR");
  });
});

describe("createSubscriptionCheckout — error inesperado", () => {
  it("UNEXPECTED_ERROR si algo no previsto lanza (ej. falla de base de datos), nunca deja escapar la excepción cruda", async () => {
    getPlanById.mockRejectedValue(new Error("connection refused: postgres"));

    const result = await createSubscriptionCheckout(INPUT);

    expect(result).toEqual({
      ok: false,
      error: { code: "UNEXPECTED_ERROR", message: "No pudimos procesar la contratación. Intentá de nuevo en unos minutos.", detail: undefined },
    });
  });
});

describe("createSubscriptionCheckout — nunca se devuelve información sensible al frontend", () => {
  it("ningún resultado de error incluye campos crudos (httpStatus/causes/rawMessage) ni texto sensible", async () => {
    const scenarios: Array<() => Promise<void>> = [
      async () => {
        getPlanById.mockResolvedValue(null);
      },
      async () => {
        createPreapproval.mockRejectedValue(
          new MercadoPagoError({ status: 400, error: "bad_request", message: "Invalid card_token_id abc123", cause: [{ code: "cc_rejected_other_reason", description: "rechazado" }] })
        );
      },
      async () => {
        createPreapproval.mockRejectedValue(new MercadoPagoNotConfiguredError());
      },
      async () => {
        getPlanById.mockRejectedValue(new Error("boom"));
      },
    ];

    for (const setup of scenarios) {
      getPlanById.mockReset();
      createPreapproval.mockReset();
      getPlanById.mockResolvedValue(PLAN_ESENCIAL);
      getSubscriptionWithPlan.mockResolvedValue(null);
      await setup();

      const result = await createSubscriptionCheckout(INPUT);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error("expected failure");

      const keys = Object.keys(result.error).sort();
      expect(keys).toEqual(["code", "detail", "message", "technicalCode"].filter((k) => k in result.error).sort());
      expect(Object.keys(result.error).every((k) => ["code", "message", "detail", "technicalCode"].includes(k))).toBe(true);
      assertNoSensitiveLeak(result.error);
    }
  });
});
