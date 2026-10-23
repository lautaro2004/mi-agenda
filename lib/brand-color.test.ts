import { describe, expect, it } from "vitest";

import { readableTextOn } from "./brand-color";

describe("readableTextOn", () => {
  it.each([
    ["#4F46E5", "light"], // índigo
    ["#FF5A1F", "dark"], // naranja vivo: contrasta más con texto oscuro
    ["#111827", "light"],
    ["#FACC15", "dark"], // amarillo
    ["#fff", "dark"],
  ] as const)("%s → texto %s", (hex, tone) => {
    expect(readableTextOn(hex)).toBe(tone);
  });

  it("sin color de marca usa texto claro (el --primary del tema es oscuro)", () => {
    expect(readableTextOn(null)).toBe("light");
  });
});
