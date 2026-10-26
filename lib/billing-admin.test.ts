import { describe, expect, it } from "vitest";

import { classifySubscription, computeSeatUsage, hasLiveMercadoPagoDebit, lostProductsMessage, productsLost } from "./billing-admin";

const sub = (over: Partial<Parameters<typeof classifySubscription>[0] & object> = {}) => ({
  status: "active",
  provider: "mercadopago",
  benefitExpiresAt: null,
  isBasePlan: false,
  ...over,
});

describe("classifySubscription", () => {
  it("distingue prueba, bonificación, paga, manual, atrasada, cancelada y vencida", () => {
    expect(classifySubscription(null)).toBe("none");
    expect(classifySubscription(sub({ isBasePlan: true, provider: "manual" }))).toBe("free");
    expect(classifySubscription(sub({ status: "trialing", provider: "benefit" }))).toBe("trial");
    expect(classifySubscription(sub({ provider: "benefit", benefitExpiresAt: new Date() }))).toBe("benefit");
    expect(classifySubscription(sub())).toBe("paid");
    expect(classifySubscription(sub({ provider: "manual" }))).toBe("manual");
    expect(classifySubscription(sub({ provider: "promo_code" }))).toBe("manual");
    expect(classifySubscription(sub({ status: "past_due" }))).toBe("past_due");
    expect(classifySubscription(sub({ status: "canceled" }))).toBe("canceled");
    expect(classifySubscription(sub({ status: "expired" }))).toBe("expired");
  });
});

describe("hasLiveMercadoPagoDebit", () => {
  const base = { provider: "mercadopago", status: "active", providerSubscriptionId: "pre_1" };
  it("activa o atrasada con preapproval = débito vivo", () => {
    expect(hasLiveMercadoPagoDebit(base)).toBe(true);
    expect(hasLiveMercadoPagoDebit({ ...base, status: "past_due" })).toBe(true);
  });
  it("cancelada/vencida, manual, sin preapproval o sin suscripción = no", () => {
    expect(hasLiveMercadoPagoDebit({ ...base, status: "canceled" })).toBe(false);
    expect(hasLiveMercadoPagoDebit({ ...base, status: "expired" })).toBe(false);
    expect(hasLiveMercadoPagoDebit({ ...base, provider: "manual" })).toBe(false);
    expect(hasLiveMercadoPagoDebit({ ...base, providerSubscriptionId: null })).toBe(false);
    expect(hasLiveMercadoPagoDebit(null)).toBe(false);
  });
});

describe("productsLost", () => {
  it("pack → solo Nodo pierde Nexo; pack → pack no pierde nada", () => {
    expect(productsLost(["nexo", "crm"], ["crm"])).toEqual(["nexo"]);
    expect(productsLost(["nexo", "crm"], ["nexo", "crm"])).toEqual([]);
    expect(productsLost(["nexo"], ["crm"])).toEqual(["nexo"]);
    expect(productsLost(null, ["crm"])).toEqual([]);
  });
  it("mensaje claro para Nexo", () => {
    expect(lostProductsMessage(["nexo"])).toContain("plan gratuito");
  });
});

describe("computeSeatUsage", () => {
  it("las invitaciones pendientes reservan lugar", () => {
    expect(computeSeatUsage({ limit: 5, members: 3, pendingInvites: 2 })).toMatchObject({ used: 3, pending: 2, reserved: 5, remaining: 0, full: true, over: false });
    expect(computeSeatUsage({ limit: 5, members: 2, pendingInvites: 1 })).toMatchObject({ remaining: 2, full: false });
  });
  it("si el plan bajó de límite: over, sin borrar a nadie", () => {
    expect(computeSeatUsage({ limit: 3, members: 5, pendingInvites: 0 })).toMatchObject({ over: true, full: true, remaining: 0 });
  });
});
