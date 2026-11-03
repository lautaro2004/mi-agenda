import { describe, expect, it } from "vitest";
import { isValidTimeZone, resolveTimeZone, todayInZone } from "@/lib/time-zone";

describe("time-zone", () => {
  it("21:30 en Argentina sigue siendo el mismo día aunque en UTC ya sea mañana", () => {
    const now = new Date("2026-11-04T00:30:00Z"); // 21:30 del 3/11 en Buenos Aires
    expect(todayInZone("America/Argentina/Buenos_Aires", now)).toBe("2026-11-03");
    expect(now.toISOString().split("T")[0]).toBe("2026-11-04");
  });
  it("respeta otras zonas", () => {
    const now = new Date("2026-11-03T23:30:00Z");
    expect(todayInZone("Europe/Madrid", now)).toBe("2026-11-04");
  });
  it("valida y cae al default", () => {
    expect(isValidTimeZone("Mars/Base")).toBe(false);
    expect(resolveTimeZone("Mars/Base")).toBe("America/Argentina/Buenos_Aires");
    expect(resolveTimeZone("America/Lima")).toBe("America/Lima");
  });
});
