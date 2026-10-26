import { describe, expect, it } from "vitest";

import { activePrice, computePackSavings, offerKind, packSavingsFor } from "./billing-pricing";

describe("computePackSavings", () => {
  it("calcula ahorro y porcentaje", () => {
    expect(computePackSavings({ nexo: 20000, crm: 30000, pack: 40000 })).toEqual({
      status: "discount",
      individualTotal: 50000,
      pack: 40000,
      savings: 10000,
      percent: 20,
    });
  });

  it("sin errores de punto flotante (centavos)", () => {
    const r = computePackSavings({ nexo: 1999.9, crm: 2999.9, pack: 4499.8 });
    expect(r).toMatchObject({ status: "discount", individualTotal: 4999.8, savings: 500, percent: 10 });
  });

  it("redondea el porcentaje a un decimal", () => {
    expect(computePackSavings({ nexo: 10000, crm: 20000, pack: 25000 })).toMatchObject({ percent: 16.7 });
  });

  it("pack igual a la suma → sin descuento", () => {
    expect(computePackSavings({ nexo: 10000, crm: 20000, pack: 30000 })).toMatchObject({ status: "no_discount", savings: 0, percent: 0 });
  });

  it("pack más caro que la suma → advertencia, nunca descuento", () => {
    expect(computePackSavings({ nexo: 10000, crm: 20000, pack: 31000 })).toMatchObject({ status: "more_expensive", savings: 0 });
  });

  it("si falta un precio no compara contra un precio inexistente", () => {
    expect(computePackSavings({ nexo: 10000, crm: null, pack: 25000 })).toEqual({ status: "unavailable", missing: ["crm"] });
    expect(computePackSavings({ nexo: null, crm: null, pack: null })).toMatchObject({ status: "unavailable" });
  });
});

describe("packSavingsFor", () => {
  const p = (month: number | null, year: number | null) => ({
    prices: [
      ...(month ? [{ interval: "month", amount: month, active: true }] : []),
      ...(year ? [{ interval: "year", amount: year, active: true }] : []),
    ],
  });

  it("compara precios del MISMO período", () => {
    expect(packSavingsFor(p(25000, 250000), p(10000, 100000), p(20000, 200000), "month")).toMatchObject({ savings: 5000 });
    expect(packSavingsFor(p(25000, 250000), p(10000, 100000), p(20000, 200000), "year")).toMatchObject({ savings: 50000 });
  });

  it("si un individual no tiene anual, el anual queda sin comparar", () => {
    expect(packSavingsFor(p(25000, 250000), p(10000, null), p(20000, 200000), "year")).toMatchObject({ status: "unavailable", missing: ["nexo"] });
  });

  it("ignora precios desactivados", () => {
    expect(activePrice([{ interval: "month", amount: 100, active: false }], "month")).toBeNull();
  });
});

describe("offerKind", () => {
  it("se decide por productos, no por nombre", () => {
    expect(offerKind(["nexo"])).toBe("nexo");
    expect(offerKind(["crm"])).toBe("crm");
    expect(offerKind(["crm", "nexo"])).toBe("pack");
  });
});
