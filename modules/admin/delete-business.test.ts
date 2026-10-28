import { describe, expect, it } from "vitest";

import { confirmNameMatches } from "./delete-business";

describe("confirmNameMatches", () => {
  it("exige el nombre exacto (ignorando espacios de los bordes)", () => {
    expect(confirmNameMatches("OD STORE", "OD STORE")).toBe(true);
    expect(confirmNameMatches("  OD STORE ", "OD STORE")).toBe(true);
  });

  it("rechaza nombres distintos, en otra capitalización o parciales", () => {
    expect(confirmNameMatches("od store", "OD STORE")).toBe(false);
    expect(confirmNameMatches("OD", "OD STORE")).toBe(false);
    expect(confirmNameMatches("", "OD STORE")).toBe(false);
    expect(confirmNameMatches("OD STORE 2", "OD STORE")).toBe(false);
  });

  it("nunca coincide si la empresa no tiene nombre", () => {
    expect(confirmNameMatches("", "")).toBe(false);
    expect(confirmNameMatches("   ", "  ")).toBe(false);
  });
});
