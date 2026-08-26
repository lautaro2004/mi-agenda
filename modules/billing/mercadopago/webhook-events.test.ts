import { describe, expect, it, vi, beforeEach } from "vitest";

const webhookEventCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mercadoPagoWebhookEvent: {
      create: (...args: unknown[]) => webhookEventCreate(...args),
    },
  },
}));

const { recordWebhookEventOnce } = await import("./webhook-events");

beforeEach(() => {
  webhookEventCreate.mockReset();
});

describe("recordWebhookEventOnce", () => {
  it("true la primera vez que se ve un id de notificación", async () => {
    webhookEventCreate.mockResolvedValue({ id: "notif_1", type: "subscription_preapproval" });
    expect(await recordWebhookEventOnce("notif_1", "subscription_preapproval")).toBe(true);
  });

  it("false si el id ya existe (choque de unique constraint P2022 -> P2002)", async () => {
    webhookEventCreate.mockRejectedValue({ code: "P2002" });
    expect(await recordWebhookEventOnce("notif_1", "subscription_preapproval")).toBe(false);
  });

  it("relanza cualquier otro error (no lo confunde con un duplicado)", async () => {
    webhookEventCreate.mockRejectedValue(new Error("DB caída"));
    await expect(recordWebhookEventOnce("notif_1", "subscription_preapproval")).rejects.toThrow("DB caída");
  });
});
