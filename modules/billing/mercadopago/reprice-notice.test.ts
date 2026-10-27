import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOwnerEmail, sendPlatformEmail } = vi.hoisted(() => ({ getOwnerEmail: vi.fn(), sendPlatformEmail: vi.fn() }));
vi.mock("@/modules/email/send", () => ({ getOwnerEmail, sendPlatformEmail }));

import { subscriptionRepriceEmail } from "@/modules/email/templates";
import { sendRepriceNotice } from "./reprice-notice";

const data = {
  businessId: "b1",
  planName: "Equipo",
  oldAmount: 100000,
  newAmount: 110000,
  listAmount: 100,
  listCurrency: "USD",
  rate: 1100,
  nextCharge: new Date("2026-11-05T12:00:00Z"),
};

beforeEach(() => {
  getOwnerEmail.mockReset().mockResolvedValue("dueno@test.com");
  sendPlatformEmail.mockReset().mockResolvedValue({ ok: true, simulated: false });
});

describe("aviso de reajuste", () => {
  it("el email explica el cambio sin tocar el precio de lista", () => {
    const email = subscriptionRepriceEmail({ ...data, nextChargeDate: "5 de noviembre" });
    expect(email.text).toContain("sube");
    expect(email.text).toContain("USD 100");
    expect(email.html).toContain("Monto nuevo");
    expect(subscriptionRepriceEmail({ ...data, newAmount: 90000, nextChargeDate: null }).text).toContain("baja");
  });

  it("envía al dueño con clave de idempotencia por ciclo", async () => {
    await sendRepriceNotice(data);
    expect(sendPlatformEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "dueno@test.com", idempotencyKey: "reprice/b1/2026-11-05" }));
  });

  it("nunca lanza: sin dueño no envía y un error de envío se absorbe", async () => {
    getOwnerEmail.mockResolvedValueOnce(null);
    await expect(sendRepriceNotice(data)).resolves.toBeUndefined();
    expect(sendPlatformEmail).not.toHaveBeenCalled();
    sendPlatformEmail.mockRejectedValueOnce(new Error("resend caído"));
    await expect(sendRepriceNotice(data)).resolves.toBeUndefined();
  });
});
