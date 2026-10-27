import { describe, expect, it } from "vitest";

import { comboChargeArs, comboNeedsRate } from "./combo-pricing";

const nexo = { amount: 30000, currency: "ARS" };
const crm = { amount: 50, currency: "USD" };

describe("combo Nexo + Nodo", () => {
  it("descuenta el 20 % de la suma de ambos planes (Nexo en pesos + Nodo en dólares)", () => {
    const r = comboChargeArs({ nexo, crm, discountPct: 20, rate: 1000 });
    expect(r.subtotalArs).toBe(80000);
    expect(r.discountArs).toBe(16000);
    expect(r.totalArs).toBe(64000);
  });

  it("los usuarios extra se suman a precio de lista, sin descuento", () => {
    const r = comboChargeArs({ nexo, crm, discountPct: 20, extraUsers: 2, extraUnit: { amount: 10, currency: "USD" }, rate: 1000 });
    expect(r.extrasArs).toBe(20000);
    expect(r.totalArs).toBe(84000);
  });

  it("con todo en pesos no necesita cotización", () => {
    const parts = { nexo, crm: { amount: 20000, currency: "ARS" } };
    expect(comboNeedsRate(parts)).toBe(false);
    expect(comboChargeArs({ ...parts, discountPct: 20, rate: null }).totalArs).toBe(40000);
    expect(comboNeedsRate({ nexo, crm })).toBe(true);
  });

  it("acota el descuento a 0–100 % y exige cotización si hay dólares", () => {
    expect(comboChargeArs({ nexo, crm, discountPct: -5, rate: 1000 }).totalArs).toBe(80000);
    expect(comboChargeArs({ nexo, crm, discountPct: 500, rate: 1000 }).totalArs).toBe(0);
    expect(() => comboChargeArs({ nexo, crm, discountPct: 20, rate: null })).toThrow();
  });

  it("rechaza extras si el plan no los ofrece", () => {
    expect(() => comboChargeArs({ nexo, crm, discountPct: 20, extraUsers: 1, rate: 1000 })).toThrow();
  });
});
