import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Rutas /api/integrations/google/*: autenticación, cookie de state y
// redirecciones. El negocio/usuario salen de la sesión (context), nunca del body.

const resolveGoogleContext = vi.fn();
vi.mock("./context", () => ({
  resolveGoogleContext: () => resolveGoogleContext(),
  GOOGLE_RETURN_TO: "/dashboard/negocio",
}));

const startConnect = vi.fn();
const completeCallback = vi.fn();
vi.mock("./oauth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./oauth")>()),
  startConnect: (...a: unknown[]) => startConnect(...a),
  completeCallback: (...a: unknown[]) => completeCallback(...a),
}));

const disconnect = vi.fn();
const getConnectionStatus = vi.fn();
vi.mock("./connection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./connection")>()),
  disconnect: (...a: unknown[]) => disconnect(...a),
  getConnectionStatus: (...a: unknown[]) => getConnectionStatus(...a),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

const { statusHandler, connectHandler, callbackHandler, disconnectHandler } = await import("./handlers");

const CTX = { userId: "user-a", businessId: "biz-a" };
const post = (body: unknown) => new Request("http://t/connect", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CLIENT_ID", "cid");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "cs");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://app.test/api/integrations/google/callback");
  vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "k");
});
afterEach(() => vi.unstubAllEnvs());

describe("sin sesión", () => {
  it("status, connect y disconnect responden 401 y no llaman a nada", async () => {
    resolveGoogleContext.mockResolvedValue(null);
    expect((await statusHandler()).status).toBe(401);
    expect((await connectHandler(post({ feature: "gmail" }))).status).toBe(401);
    expect((await disconnectHandler()).status).toBe(401);
    expect(startConnect).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  });

  it("callback sin sesión redirige al login sin procesar el code", async () => {
    resolveGoogleContext.mockResolvedValue(null);
    const res = await callbackHandler(new Request("https://app.test/api/integrations/google/callback?code=c&state=s"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://app.test/login");
    expect(completeCallback).not.toHaveBeenCalled();
  });
});

describe("con sesión", () => {
  beforeEach(() => resolveGoogleContext.mockResolvedValue(CTX));

  it("status devuelve solo estado, sin tokens", async () => {
    getConnectionStatus.mockResolvedValue({ connected: true, status: "active", googleEmail: "a@gmail.com", features: { gmail: true, calendar: false } });
    const body = await (await statusHandler()).json();
    expect(getConnectionStatus).toHaveBeenCalledWith(CTX);
    expect(body).toMatchObject({ configured: true, connected: true, googleEmail: "a@gmail.com" });
    expect(JSON.stringify(body)).not.toMatch(/token/i);
  });

  it("connect valida la funcionalidad y usa el contexto de la sesión, no el body", async () => {
    startConnect.mockResolvedValue({ url: "https://accounts.google.com/x", nonce: "n1", state: "s" });
    expect((await connectHandler(post({ feature: "drive" }))).status).toBe(400);

    const res = await connectHandler(post({ feature: "gmail", businessId: "biz-EVIL", userId: "user-EVIL", returnTo: "https://evil.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://accounts.google.com/x" });
    // Contexto de sesión y returnTo saneado (no el enviado por el cliente).
    expect(startConnect).toHaveBeenCalledWith(CTX, "gmail", "/dashboard/negocio");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("google_oauth_nonce=n1");
    expect(cookie.toLowerCase()).toContain("httponly");
  });

  it("connect indica cuando el permiso ya estaba otorgado y no pide autorizar", async () => {
    startConnect.mockResolvedValue({ alreadyGranted: true });
    const res = await connectHandler(post({ feature: "calendar" }));
    expect(await res.json()).toEqual({ alreadyGranted: true });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("connect responde 503 si Google no está configurado en el entorno", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    expect((await connectHandler(post({ feature: "gmail" }))).status).toBe(503);
  });

  it("callback exitoso vuelve a la pantalla de origen con google=connected", async () => {
    completeCallback.mockResolvedValue({ ok: true, returnTo: "/dashboard/negocio", feature: "gmail" });
    const req = new Request("https://app.test/api/integrations/google/callback?code=c&state=s", { headers: { cookie: "a=1; google_oauth_nonce=n1" } });
    const res = await callbackHandler(req);

    expect(completeCallback).toHaveBeenCalledWith(expect.objectContaining({ scope: CTX, cookieNonce: "n1" }));
    expect(res.headers.get("location")).toBe("https://app.test/dashboard/negocio?google=connected");
    expect(res.headers.get("set-cookie")).toContain("google_oauth_nonce=;");
  });

  it("callback cancelado o inválido vuelve con el motivo, sin conectar", async () => {
    completeCallback.mockResolvedValue({ ok: false, reason: "cancelled", returnTo: "/dashboard/negocio" });
    const res = await callbackHandler(new Request("https://app.test/api/integrations/google/callback?error=access_denied&state=s"));
    expect(res.headers.get("location")).toBe("https://app.test/dashboard/negocio?google=cancelled");
  });

  it("disconnect usa el contexto de la sesión", async () => {
    disconnect.mockResolvedValue(true);
    const res = await disconnectHandler();
    expect(res.status).toBe(200);
    expect(disconnect).toHaveBeenCalledWith(CTX);
  });
});
