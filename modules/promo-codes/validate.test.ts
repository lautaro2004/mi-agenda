import { describe, expect, it } from "vitest";

import { computeBonusExpiresAt, evaluatePromoCode, generatePromoCode, normalizePromoCode } from "./validate";

const NOW = new Date("2026-08-24T12:00:00.000Z");

function baseCode(overrides: Partial<Parameters<typeof evaluatePromoCode>[0] extends infer T ? NonNullable<T> : never> = {}) {
  return {
    active: true,
    expiresAt: new Date("2026-12-31T23:59:59.000Z"),
    maxUses: 1 as number | null,
    usedCount: 0,
    ...overrides,
  };
}

describe("evaluatePromoCode", () => {
  it("código inexistente", () => {
    expect(evaluatePromoCode(null, NOW)).toEqual({ ok: false, reason: "not_found" });
  });

  it("código válido (de un solo uso, sin usar)", () => {
    expect(evaluatePromoCode(baseCode({ maxUses: 1, usedCount: 0 }), NOW)).toEqual({ ok: true });
  });

  it("código válido (múltiples usos, parcialmente usado)", () => {
    expect(evaluatePromoCode(baseCode({ maxUses: 50, usedCount: 12 }), NOW)).toEqual({ ok: true });
  });

  it("código válido (sin límite de usos)", () => {
    expect(evaluatePromoCode(baseCode({ maxUses: null, usedCount: 9999 }), NOW)).toEqual({ ok: true });
  });

  it("código vencido", () => {
    const expired = baseCode({ expiresAt: new Date("2026-01-01T00:00:00.000Z") });
    expect(evaluatePromoCode(expired, NOW)).toEqual({ ok: false, reason: "expired" });
  });

  it("código inactivo", () => {
    expect(evaluatePromoCode(baseCode({ active: false }), NOW)).toEqual({ ok: false, reason: "inactive" });
  });

  it("código agotado (un solo uso, ya usado)", () => {
    expect(evaluatePromoCode(baseCode({ maxUses: 1, usedCount: 1 }), NOW)).toEqual({ ok: false, reason: "exhausted" });
  });

  it("código agotado (múltiples usos, límite alcanzado)", () => {
    expect(evaluatePromoCode(baseCode({ maxUses: 10, usedCount: 10 }), NOW)).toEqual({ ok: false, reason: "exhausted" });
  });

  it("inactivo y vencido a la vez reporta inactivo primero (mismo orden que la sección 5 del pedido)", () => {
    const both = baseCode({ active: false, expiresAt: new Date("2020-01-01T00:00:00.000Z") });
    expect(evaluatePromoCode(both, NOW)).toEqual({ ok: false, reason: "inactive" });
  });

  it("expiresAt es inclusivo: válido hasta ese instante exacto, vencido un milisegundo después", () => {
    expect(evaluatePromoCode(baseCode({ expiresAt: NOW }), NOW)).toEqual({ ok: true });
    expect(evaluatePromoCode(baseCode({ expiresAt: NOW }), new Date(NOW.getTime() + 1))).toEqual({
      ok: false,
      reason: "expired",
    });
  });
});

describe("computeBonusExpiresAt", () => {
  it("suma la cantidad de días exacta en milisegundos", () => {
    const result = computeBonusExpiresAt(90, NOW);
    expect(result.getTime() - NOW.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });

  it("1 mes (30 días) desde una fecha conocida", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const result = computeBonusExpiresAt(30, from);
    expect(result.toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });

  it("12 meses (365 días) desde una fecha conocida", () => {
    const from = new Date("2026-01-01T00:00:00.000Z");
    const result = computeBonusExpiresAt(365, from);
    expect(result.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("normalizePromoCode", () => {
  it("pasa a mayúsculas y recorta espacios", () => {
    expect(normalizePromoCode("  nexo-pro-3m-8k4f  ")).toBe("NEXO-PRO-3M-8K4F");
  });

  it("elimina espacios internos", () => {
    expect(normalizePromoCode("nexo pro 3m 8k4f")).toBe("NEXOPRO3M8K4F");
  });
});

describe("generatePromoCode", () => {
  it("tiene el formato NEXO-{PLAN}-{DURACION}-{SUFIJO}", () => {
    const code = generatePromoCode("profesional", 90);
    expect(code).toMatch(/^NEXO-PROF-3M-[A-Z0-9]{4}$/);
  });

  it("usa días cuando la duración no es múltiplo de 30", () => {
    const code = generatePromoCode("gratis", 45);
    expect(code).toMatch(/^NEXO-GRAT-45D-[A-Z0-9]{4}$/);
  });

  it("genera sufijos distintos en llamadas sucesivas (no determinístico)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generatePromoCode("esencial", 30)));
    expect(codes.size).toBeGreaterThan(1);
  });
});
