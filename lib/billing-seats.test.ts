import { describe, expect, it } from "vitest";

import { priceWithExtras, seatLimit, tierWarnings } from "@/lib/billing-seats";

describe("seatLimit / priceWithExtras", () => {
  it("suma incluidos y extras", () => {
    expect(seatLimit(3, 2)).toBe(5);
    expect(seatLimit(3, -4)).toBe(3);
  });
  it("calcula el precio con extras en centavos", () => {
    expect(priceWithExtras(30, 30, 2)).toBe(90);
    expect(priceWithExtras(80, 19.99, 1)).toBe(99.99);
    expect(priceWithExtras(80, null, 0)).toBe(80);
  });
  it("rechaza extras en un plan que no los ofrece", () => {
    expect(() => priceWithExtras(80, null, 1)).toThrow();
  });
});

describe("tierWarnings", () => {
  const t = (name: string, users: number, price: number, extraUserPrice: number | null) => ({ name, users, price, extraUserPrice });
  it("detecta que 1 usuario + 2 extras a 20 sale más barato que el plan de 3", () => {
    const w = tierWarnings([t("Nodo 1", 1, 30, 20), t("Nodo 3", 3, 80, null)]);
    expect(w).toHaveLength(1);
    expect(w[0]).toContain("25");
  });
  it("sin avisos con extra de 30 en el plan de 1 y 20 en el de 3", () => {
    expect(tierWarnings([t("Nodo 1", 1, 30, 30), t("Nodo 3", 3, 80, 20), t("Nodo 5", 5, 115, null)])).toEqual([]);
  });
  it("avisa si un tamaño intermedio cuesta más que el plan siguiente", () => {
    const w = tierWarnings([t("Nodo 5", 5, 115, 20), t("Nodo 10", 10, 190, null)]);
    expect(w.some((m) => m.includes("cuesta igual o más"))).toBe(true);
  });
  it("con extra de 18 en el plan de 5 y 190 el de 10 queda consistente", () => {
    expect(tierWarnings([t("Nodo 5", 5, 115, 18), t("Nodo 10", 10, 190, null)])).toEqual([]);
  });
});
