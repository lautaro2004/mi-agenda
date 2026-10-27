import { afterEach, describe, expect, it, vi } from "vitest";

import { FxUnavailableError, __resetFxCache, convertToArs, getUsdArsRate, needsConversion, relativeChange } from "@/lib/fx";

afterEach(() => {
  vi.unstubAllGlobals();
  __resetFxCache();
});

describe("convertToArs", () => {
  it("convierte en centavos sin errores de float", () => {
    expect(convertToArs(50, 1500)).toBe(75000);
    expect(convertToArs(19.99, 1234.5678)).toBe(24679.01);
    expect(convertToArs(0.1, 3)).toBe(0.3);
  });
  it("rechaza valores inválidos", () => {
    expect(() => convertToArs(10, 0)).toThrow();
    expect(() => convertToArs(-1, 100)).toThrow();
    expect(() => convertToArs(Number.NaN, 100)).toThrow();
  });
});

describe("needsConversion / relativeChange", () => {
  it("ARS no se convierte, USD sí", () => {
    expect(needsConversion("ARS")).toBe(false);
    expect(needsConversion("usd")).toBe(true);
  });
  it("calcula la variación relativa", () => {
    expect(relativeChange(100, 105)).toBeCloseTo(0.05);
    expect(relativeChange(0, 10)).toBe(Infinity);
  });
});

describe("getUsdArsRate", () => {
  it("usa la primera fuente y cachea", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ venta: 1480, fechaActualizacion: "2026-10-26T12:00:00Z" }) });
    vi.stubGlobal("fetch", fetchMock);
    expect((await getUsdArsRate()).rate).toBe(1480);
    await getUsdArsRate();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("cae a la segunda fuente si la primera falla", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ oficial: { value_sell: 1490 } }) });
    vi.stubGlobal("fetch", fetchMock);
    expect((await getUsdArsRate()).rate).toBe(1490);
  });
  it("sin fuentes ni cache lanza FxUnavailableError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("red")));
    await expect(getUsdArsRate()).rejects.toBeInstanceOf(FxUnavailableError);
  });
});
