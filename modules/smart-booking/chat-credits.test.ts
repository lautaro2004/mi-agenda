import { describe, expect, it } from "vitest";

import { computeChatCredits, monthStart } from "./chat-credits";

describe("créditos del chat web", () => {
  it("calcula lo que queda y bloquea al agotarse", () => {
    expect(computeChatCredits(300, 120, true)).toMatchObject({ remaining: 180, allowed: true });
    expect(computeChatCredits(300, 300, true).remaining).toBe(0);
    expect(computeChatCredits(300, 999, true).remaining).toBe(0);
  });

  it("sin créditos en el plan o sin acceso no se permite", () => {
    expect(computeChatCredits(0, 0, true).allowed).toBe(false);
    expect(computeChatCredits(300, 0, false).allowed).toBe(false);
  });

  it("el mes empieza en hora de Argentina", () => {
    // 1/11 01:00 UTC = 31/10 22:00 en Argentina → todavía es octubre.
    expect(monthStart(new Date("2026-11-01T01:00:00Z")).toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(monthStart(new Date("2026-10-27T15:00:00Z")).toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });
});
