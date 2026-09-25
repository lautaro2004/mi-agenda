import { describe, expect, it } from "vitest";

import { buildPlanFeatureLines, formatAiCredits, type SubscriptionPlanInfo } from "./subscription-client";

const base: SubscriptionPlanInfo = {
  id: "p",
  name: "x",
  slug: "x",
  monthlyPrice: 0,
  currency: "ARS",
  aiCredits: 0,
  maxServices: null,
  publicWebEnabled: false,
  whatsappEnabled: false,
  depositsEnabled: false,
  customTrainingEnabled: false,
  statsEnabled: false,
  galleryEnabled: false,
  digitalMenuEnabled: false,
  active: true,
  mercadoPagoPlanId: null,
};

describe("buildPlanFeatureLines / formatAiCredits", () => {
  it("Agenda interna: solo agenda, sin web ni IA, créditos 'No incluye'", () => {
    const lines = buildPlanFeatureLines(base);
    expect(lines).toContain("Agenda, servicios y horarios");
    expect(lines.join(" ")).not.toMatch(/Web pública|WhatsApp|Carta|respuestas de IA/);
    expect(lines).toContain("Créditos de IA: No incluye");
  });

  it("Esencial: agenda + web + galería + estadísticas, sin WhatsApp/IA ni créditos", () => {
    const lines = buildPlanFeatureLines({ ...base, publicWebEnabled: true, galleryEnabled: true, statsEnabled: true });
    expect(lines).toContain("Web pública con reservas online");
    expect(lines).toContain("Galería de fotos");
    expect(lines.join(" ")).not.toMatch(/WhatsApp|Carta|respuestas de IA/);
    expect(lines).toContain("Créditos de IA: No incluye");
  });

  it("Profesional: suma WhatsApp/IA, señas, carta y muestra créditos", () => {
    const lines = buildPlanFeatureLines({
      ...base,
      aiCredits: 1000,
      publicWebEnabled: true,
      whatsappEnabled: true,
      depositsEnabled: true,
      customTrainingEnabled: true,
      statsEnabled: true,
      galleryEnabled: true,
      digitalMenuEnabled: true,
    });
    expect(lines.join(" ")).toMatch(/WhatsApp con IA/);
    expect(lines).toContain("Señas y comprobantes de pago");
    expect(lines).toContain("Carta digital + QR");
    expect(lines).toContain(`${formatAiCredits(1000)} respuestas de IA / mes`);
  });

  it("formatAiCredits: 0 → 'No incluye'", () => {
    expect(formatAiCredits(0)).toBe("No incluye");
    expect(formatAiCredits(2500)).not.toBe("No incluye");
  });
});
