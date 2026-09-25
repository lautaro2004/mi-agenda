import { describe, expect, it } from "vitest";

import { suggestPlanSlug } from "./suggest-plan";

describe("suggestPlanSlug", () => {
  it("reservas + necesidades básicas → esencial", () => {
    expect(suggestPlanSlug(["more_bookings", "organize_business"])).toBe("esencial");
  });

  it("sin ninguna selección → esencial (nunca undefined/crash)", () => {
    expect(suggestPlanSlug([])).toBe("esencial");
  });

  it("presencia web + organización, sin automatización → esencial", () => {
    expect(suggestPlanSlug(["better_web_presence", "organize_business", "other"])).toBe("esencial");
  });

  it("whatsapp + automatización + reservas → profesional", () => {
    expect(suggestPlanSlug(["more_bookings", "automate_whatsapp", "automate_inquiries"])).toBe("profesional");
  });

  it("solo automatizar consultas (sin whatsapp explícito) → profesional", () => {
    expect(suggestPlanSlug(["automate_inquiries"])).toBe("profesional");
  });

  it("carta digital/QR + whatsapp + automatización → profesional", () => {
    expect(suggestPlanSlug(["digital_menu", "automate_whatsapp", "automate_inquiries"])).toBe("profesional");
  });

  it("carta digital solo (sin nada más) → profesional igual — es el gate real del plan", () => {
    expect(suggestPlanSlug(["digital_menu"])).toBe("profesional");
  });
});
