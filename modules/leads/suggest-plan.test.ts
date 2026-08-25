import { describe, expect, it } from "vitest";

import { suggestPlanSlug } from "./suggest-plan";

describe("suggestPlanSlug", () => {
  it("reservas + necesidades básicas → gratis", () => {
    expect(suggestPlanSlug(["more_bookings", "organize_business"])).toBe("gratis");
  });

  it("sin ninguna selección → gratis (nunca undefined/crash)", () => {
    expect(suggestPlanSlug([])).toBe("gratis");
  });

  it("presencia web + organización, sin automatización → gratis", () => {
    expect(suggestPlanSlug(["better_web_presence", "organize_business", "other"])).toBe("gratis");
  });

  it("whatsapp + automatización + reservas → esencial", () => {
    expect(suggestPlanSlug(["more_bookings", "automate_whatsapp", "automate_inquiries"])).toBe("esencial");
  });

  it("solo automatizar consultas (sin whatsapp explícito) → esencial", () => {
    expect(suggestPlanSlug(["automate_inquiries"])).toBe("esencial");
  });

  it("carta digital/QR + whatsapp + automatización → profesional", () => {
    expect(suggestPlanSlug(["digital_menu", "automate_whatsapp", "automate_inquiries"])).toBe("profesional");
  });

  it("carta digital solo (sin nada más) → profesional igual — es el gate real del plan", () => {
    expect(suggestPlanSlug(["digital_menu"])).toBe("profesional");
  });
});
