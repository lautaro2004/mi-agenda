import { describe, expect, it, vi } from "vitest";

const getSubscription = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { subscription: { findUnique: (...a: unknown[]) => getSubscription(...a) }, plan: { findUnique: vi.fn() } } }));

const { resolvePlanFeatures } = await import("./subscription");

// Matriz comercial: Esencial+ = Esencial + agenda inteligente + chat web, y NADA más.
const plan = (over: Record<string, unknown> = {}) => ({
  maxServices: null,
  publicWebEnabled: true,
  whatsappEnabled: false,
  depositsEnabled: false,
  customTrainingEnabled: false,
  statsEnabled: true,
  galleryEnabled: true,
  digitalMenuEnabled: false,
  smartBookingEnabled: false,
  webAiChatEnabled: false,
  ...over,
});
const sub = (nexoPlan: Record<string, unknown>) => ({ nexoPlan }) as never;

describe("resolvePlanFeatures — agenda inteligente", () => {
  it("Esencial no incluye agenda inteligente ni chat web", () => {
    const f = resolvePlanFeatures(sub(plan()));
    expect(f.smartBookingEnabled).toBe(false);
    expect(f.webAiChatEnabled).toBe(false);
  });

  it("Esencial+ habilita agenda inteligente y chat web, pero NO WhatsApp, señas ni entrenamiento", () => {
    const f = resolvePlanFeatures(sub(plan({ smartBookingEnabled: true, webAiChatEnabled: true })));
    expect(f.smartBookingEnabled).toBe(true);
    expect(f.webAiChatEnabled).toBe(true);
    expect(f.whatsappEnabled).toBe(false);
    expect(f.depositsEnabled).toBe(false);
    expect(f.customTrainingEnabled).toBe(false);
    expect(f.digitalMenuEnabled).toBe(false);
  });

  it("Profesional conserva WhatsApp, señas y entrenamiento y suma las dos nuevas", () => {
    const f = resolvePlanFeatures(
      sub(plan({ whatsappEnabled: true, depositsEnabled: true, customTrainingEnabled: true, digitalMenuEnabled: true, smartBookingEnabled: true, webAiChatEnabled: true }))
    );
    expect(f).toMatchObject({ whatsappEnabled: true, depositsEnabled: true, customTrainingEnabled: true, smartBookingEnabled: true, webAiChatEnabled: true });
  });

  it("sin suscripción (fallback legacy) las funciones nuevas NO se habilitan", () => {
    const f = resolvePlanFeatures(null);
    expect(f.smartBookingEnabled).toBe(false);
    expect(f.webAiChatEnabled).toBe(false);
  });
});

describe("gates de servidor", () => {
  it("sin suscripción, los gates de servidor responden que no", async () => {
    const { canUseSmartBooking, canUseWebAiChat } = await import("./subscription");
    getSubscription.mockResolvedValue(null);
    expect(await canUseSmartBooking("biz")).toBe(false);
    expect(await canUseWebAiChat("biz")).toBe(false);
  });
});
