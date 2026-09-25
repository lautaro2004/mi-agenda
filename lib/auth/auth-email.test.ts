import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";

// Prueba de integración de verificación de cuenta y recuperación de contraseña
// con la configuración REAL de lib/auth/auth-options.ts, sobre el adaptador en
// memoria de Better Auth. Solo el envío está simulado: el mock solo expone
// sendPlatformEmail, así que si estos flujos usaran sendBusinessEmail fallarían.

const sendPlatformEmail = vi.hoisted(() => vi.fn());
vi.mock("@/modules/email/send", () => ({ sendPlatformEmail: (m: unknown) => sendPlatformEmail(m) }));

const { createAuthOptions, RESET_TOKEN_TTL_SECONDS } = await import("./auth-options");

type Db = Record<string, Record<string, unknown>[]>;
let db: Db;
let auth: ReturnType<typeof makeAuth>;

function makeAuth(database: Db) {
  return betterAuth({
    ...createAuthOptions(),
    secret: "test-secret-test-secret-test-secret-123",
    baseURL: "http://localhost:3000",
    // En producción los ids los genera Postgres (generateId: false); el
    // adaptador en memoria necesita que Better Auth los genere.
    advanced: {},
    database: memoryAdapter(database),
  });
}

const USER = { name: "Lucía Pérez", email: "lucia@test.com", password: "clave-original-123" };

function lastEmail() {
  const calls = sendPlatformEmail.mock.calls;
  return calls[calls.length - 1][0] as { to: string; subject: string; html: string; text: string };
}

// Extrae el token del enlace que recibió el usuario por email.
function tokenFromEmail(kind: "verify" | "reset"): string {
  const url = lastEmail().text.match(/https?:\/\/\S+/)![0];
  const parsed = new URL(url);
  return kind === "verify" ? parsed.searchParams.get("token")! : parsed.pathname.split("/").pop()!;
}

async function signUp() {
  return auth.api.signUpEmail({ body: { ...USER, callbackURL: "/dashboard" } });
}

beforeEach(() => {
  db = { user: [], session: [], account: [], verification: [] };
  auth = makeAuth(db);
  sendPlatformEmail.mockReset();
  sendPlatformEmail.mockResolvedValue({ ok: true, simulated: false });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("registro y verificación de cuenta", () => {
  it("al registrarse envía el email de verificación al usuario, por la capa de plataforma", async () => {
    await signUp();
    expect(sendPlatformEmail).toHaveBeenCalledTimes(1);
    const email = lastEmail();
    expect(email.to).toBe(USER.email);
    expect(email.subject).toContain("Confirmá tu email");
    expect(email.html).toContain("Confirmar mi email");
    expect(db.user[0].emailVerified).toBe(false);
  });

  it("el enlace del email verifica la cuenta", async () => {
    await signUp();
    await auth.api.verifyEmail({ query: { token: tokenFromEmail("verify") } });
    expect(db.user[0].emailVerified).toBe(true);
  });

  it("un token de verificación inválido se rechaza y no verifica nada", async () => {
    await signUp();
    await expect(auth.api.verifyEmail({ query: { token: "no-es-un-token" } })).rejects.toThrow();
    expect(db.user[0].emailVerified).toBe(false);
  });

  it("un token de verificación vencido (24 h) se rechaza", async () => {
    await signUp();
    const token = tokenFromEmail("verify");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
    await expect(auth.api.verifyEmail({ query: { token } })).rejects.toThrow();
    expect(db.user[0].emailVerified).toBe(false);
  });

  it("el usuario puede pedir otro email de verificación", async () => {
    await signUp();
    sendPlatformEmail.mockClear();
    await auth.api.sendVerificationEmail({ body: { email: USER.email, callbackURL: "/dashboard" } });
    expect(sendPlatformEmail).toHaveBeenCalledTimes(1);
    expect(lastEmail().to).toBe(USER.email);
  });

  it("no se exige verificar el email para iniciar sesión (no bloquea cuentas existentes)", async () => {
    await signUp();
    const result = await auth.api.signInEmail({ body: { email: USER.email, password: USER.password } });
    expect(result.user.email).toBe(USER.email);
  });
});

describe("recuperación de contraseña", () => {
  beforeEach(async () => {
    await signUp();
    sendPlatformEmail.mockClear();
  });

  it("la solicitud envía un email con enlace de un solo uso al usuario", async () => {
    await auth.api.requestPasswordReset({ body: { email: USER.email, redirectTo: "/restablecer-contrasena" } });
    expect(sendPlatformEmail).toHaveBeenCalledTimes(1);
    const email = lastEmail();
    expect(email.to).toBe(USER.email);
    expect(email.subject).toContain("Restablecé tu contraseña");
    expect(email.text).toContain("vence en 60 minutos");
    expect(RESET_TOKEN_TTL_SECONDS).toBe(3600);
  });

  it("cambio exitoso: con el token se elige otra contraseña y la vieja deja de servir", async () => {
    await auth.api.requestPasswordReset({ body: { email: USER.email, redirectTo: "/restablecer-contrasena" } });
    await auth.api.resetPassword({ body: { newPassword: "clave-nueva-456", token: tokenFromEmail("reset") } });

    await expect(auth.api.signInEmail({ body: { email: USER.email, password: USER.password } })).rejects.toThrow();
    const ok = await auth.api.signInEmail({ body: { email: USER.email, password: "clave-nueva-456" } });
    expect(ok.user.email).toBe(USER.email);
  });

  it("al cambiar la contraseña se cierran las sesiones abiertas", async () => {
    await auth.api.signInEmail({ body: { email: USER.email, password: USER.password } });
    expect(db.session.length).toBeGreaterThan(0);

    await auth.api.requestPasswordReset({ body: { email: USER.email, redirectTo: "/restablecer-contrasena" } });
    await auth.api.resetPassword({ body: { newPassword: "clave-nueva-456", token: tokenFromEmail("reset") } });
    expect(db.session).toHaveLength(0);
  });

  it("token usado nuevamente: el segundo intento con el mismo token falla", async () => {
    await auth.api.requestPasswordReset({ body: { email: USER.email, redirectTo: "/restablecer-contrasena" } });
    const token = tokenFromEmail("reset");
    await auth.api.resetPassword({ body: { newPassword: "clave-nueva-456", token } });

    await expect(auth.api.resetPassword({ body: { newPassword: "otra-clave-789", token } })).rejects.toThrow();
    // La contraseña sigue siendo la del primer cambio.
    await expect(auth.api.signInEmail({ body: { email: USER.email, password: "otra-clave-789" } })).rejects.toThrow();
    await auth.api.signInEmail({ body: { email: USER.email, password: "clave-nueva-456" } });
  });

  it("token inexistente o inválido: se rechaza", async () => {
    await expect(auth.api.resetPassword({ body: { newPassword: "clave-nueva-456", token: "inventado" } })).rejects.toThrow();
    await auth.api.signInEmail({ body: { email: USER.email, password: USER.password } });
  });

  it("token vencido: se rechaza y la contraseña no cambia", async () => {
    await auth.api.requestPasswordReset({ body: { email: USER.email, redirectTo: "/restablecer-contrasena" } });
    const token = tokenFromEmail("reset");
    // Vence pasada la hora de vigencia.
    for (const row of db.verification) row.expiresAt = new Date(Date.now() - 1000);

    await expect(auth.api.resetPassword({ body: { newPassword: "clave-nueva-456", token } })).rejects.toThrow();
    await auth.api.signInEmail({ body: { email: USER.email, password: USER.password } });
  });

  it("una contraseña demasiado corta se rechaza sin consumir el token", async () => {
    await auth.api.requestPasswordReset({ body: { email: USER.email, redirectTo: "/restablecer-contrasena" } });
    const token = tokenFromEmail("reset");
    await expect(auth.api.resetPassword({ body: { newPassword: "corta", token } })).rejects.toThrow();
    await auth.api.resetPassword({ body: { newPassword: "clave-nueva-456", token } });
  });
});

describe("usuario inexistente y no filtración de información", () => {
  beforeEach(async () => {
    await signUp();
    sendPlatformEmail.mockClear();
  });

  it("un email no registrado no recibe nada y la respuesta es idéntica a la de uno registrado", async () => {
    const known = await auth.api.requestPasswordReset({ body: { email: USER.email, redirectTo: "/restablecer-contrasena" } });
    sendPlatformEmail.mockClear();
    const unknown = await auth.api.requestPasswordReset({ body: { email: "nadie@test.com", redirectTo: "/restablecer-contrasena" } });

    expect(sendPlatformEmail).not.toHaveBeenCalled();
    expect(unknown).toEqual(known);
  });

  it("la respuesta de la solicitud no incluye el token ni el enlace", async () => {
    const response = await auth.api.requestPasswordReset({ body: { email: USER.email, redirectTo: "/restablecer-contrasena" } });
    const token = tokenFromEmail("reset");
    expect(JSON.stringify(response)).not.toContain(token);
    expect(JSON.stringify(response)).not.toContain("http");
  });

  it("el email solo contiene el enlace para SU destinatario, sin datos de otros usuarios", async () => {
    await auth.api.signUpEmail({ body: { name: "Otro", email: "otro@test.com", password: "clave-otro-123" } });
    sendPlatformEmail.mockClear();
    await auth.api.requestPasswordReset({ body: { email: USER.email, redirectTo: "/restablecer-contrasena" } });

    const email = lastEmail();
    expect(email.to).toBe(USER.email);
    expect(email.html + email.text).not.toContain("otro@test.com");
    expect(email.html + email.text).not.toContain(USER.password);
  });

  it("si Resend falla, el flujo no se rompe ni se loguea el token o el enlace", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    sendPlatformEmail.mockResolvedValue({ ok: false, error: "boom" });

    const response = await auth.api.requestPasswordReset({ body: { email: USER.email, redirectTo: "/restablecer-contrasena" } });
    expect(response).toBeTruthy();

    expect(errorLog).toHaveBeenCalled();
    const logged = JSON.stringify(errorLog.mock.calls);
    expect(logged).not.toContain("http");
    expect(logged).not.toContain("token");
  });

  it("el hash de la contraseña no se devuelve en ninguna respuesta", async () => {
    const signIn = await auth.api.signInEmail({ body: { email: USER.email, password: USER.password } });
    const serialized = JSON.stringify(signIn);
    expect(serialized).not.toContain(String(db.account[0].password));
    expect(serialized).not.toContain(USER.password);
  });
});
