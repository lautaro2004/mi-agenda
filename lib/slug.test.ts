import { describe, expect, it } from "vitest";
import { normalizeSlug, slugSchema } from "@/lib/slug";

describe("slug", () => {
  it("normaliza tildes, espacios y mayúsculas", () => {
    expect(normalizeSlug("  LM Rappi Gastronómico! ")).toBe("lm-rappi-gastronomico");
  });
  it("acepta slugs válidos y rechaza cortos o reservados", () => {
    expect(slugSchema.safeParse("lm-rappi").data).toBe("lm-rappi");
    expect(slugSchema.safeParse("ab").success).toBe(false);
    expect(slugSchema.safeParse("Dashboard").success).toBe(false);
    expect(slugSchema.safeParse("$$$").success).toBe(false);
  });
});
