import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildFromHeader, sendViaResend } from "./provider";

const message = { to: "cliente@test.com", subject: "Hola", html: "<p>Hola</p>" };

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test");
  vi.stubEnv("EMAIL_FROM", "Nexo <contacto@kodexa.ar>");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sendViaResend", () => {
  it("sin RESEND_API_KEY simula el envío y no llama a la red", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await sendViaResend(message)).toEqual({ ok: true, simulated: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envía el Idempotency-Key, el reply-to y el nombre visible del negocio", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "msg_1" }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendViaResend({
      ...message,
      fromName: 'Peluquería "Lola" <x>',
      replyTo: "duena@test.com",
      idempotencyKey: "booking-confirmation/abc",
    });

    expect(result).toEqual({ ok: true, simulated: false, messageId: "msg_1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers["Idempotency-Key"]).toBe("booking-confirmation/abc");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body);
    expect(body.reply_to).toBe("duena@test.com");
    expect(body.to).toEqual(["cliente@test.com"]);
    // El nombre se sanea (sin <, > ni comillas) y la dirección es la de la plataforma.
    expect(body.from).toBe("Peluquería Lola x <contacto@kodexa.ar>");
  });

  it("no manda Idempotency-Key si no se pasó", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "m" }) });
    vi.stubGlobal("fetch", fetchMock);
    await sendViaResend(message);
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBeUndefined();
  });

  it("devuelve el error del proveedor y los errores de red sin lanzar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({ message: "dominio no verificado" }) }));
    expect(await sendViaResend(message)).toEqual({ ok: false, error: "dominio no verificado" });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await sendViaResend(message)).toEqual({ ok: false, error: "network_error" });
  });
});

describe("buildFromHeader", () => {
  it("usa el remitente de la plataforma cuando no hay nombre", () => {
    expect(buildFromHeader()).toBe("Nexo <contacto@kodexa.ar>");
  });
});
