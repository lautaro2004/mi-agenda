import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Núcleo Google compartido (cifrado, GoogleConnection, OAuth). Prisma en
// memoria + fetch simulado: el navegador y Google nunca se tocan de verdad.

type Row = {
  id: string;
  businessId: string;
  userId: string;
  googleEmail: string;
  refreshTokenEnc: string | null;
  scopes: string[];
  status: string;
};
const db = vi.hoisted(() => ({ rows: [] as Row[] }));

vi.mock("@/lib/prisma", () => {
  const match = (r: Row, w: Partial<Row>) => Object.entries(w).every(([k, v]) => (r as Record<string, unknown>)[k] === v);
  return {
    prisma: {
      googleConnection: {
        findFirst: async ({ where }: { where: Partial<Row> }) => db.rows.find((r) => match(r, where)) ?? null,
        upsert: async ({ where, create, update }: { where: { businessId_userId: { businessId: string; userId: string } }; create: Row; update: Partial<Row> }) => {
          const key = where.businessId_userId;
          const existing = db.rows.find((r) => r.businessId === key.businessId && r.userId === key.userId);
          if (existing) return Object.assign(existing, update);
          const row = { ...create, id: `gc-${db.rows.length + 1}` };
          db.rows.push(row);
          return row;
        },
        updateMany: async ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
          const hit = db.rows.filter((r) => match(r, where));
          hit.forEach((r) => Object.assign(r, data));
          return { count: hit.length };
        },
        deleteMany: async ({ where }: { where: Partial<Row> }) => {
          const before = db.rows.length;
          db.rows = db.rows.filter((r) => !match(r, where));
          return { count: before - db.rows.length };
        },
      },
    },
  };
});

const { encryptToken, decryptToken } = await import("./crypto");
const { saveConnection, getConnectionStatus, getAccessToken, disconnect, GoogleConnectionError } = await import("./connection");
const { startConnect, completeCallback, createOAuthState, verifyOAuthState, sanitizeReturnTo } = await import("./oauth");
const { FEATURE_SCOPES } = await import("./scopes");

const A = { businessId: "biz-a", userId: "user-a" };
const B = { businessId: "biz-b", userId: "user-b" };
const GMAIL = FEATURE_SCOPES.gmail;
const CALENDAR = FEATURE_SCOPES.calendar;
const SECRET_REFRESH = "1//refresh-token-super-secreto";

const jsonResponse = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body });
const idToken = (email: string) => `x.${Buffer.from(JSON.stringify({ email })).toString("base64url")}.y`;

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  db.rows = [];
  vi.stubEnv("GOOGLE_CLIENT_ID", "client-id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://app.test/api/integrations/google/callback");
  vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));
  vi.stubEnv("BETTER_AUTH_SECRET", "state-secret-state-secret-123456");
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cifrado AES-256-GCM", () => {
  it("cifra y descifra, y el texto cifrado no contiene el token", () => {
    const enc = encryptToken(SECRET_REFRESH, "biz-a:user-a");
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain(SECRET_REFRESH);
    expect(decryptToken(enc, "biz-a:user-a")).toBe(SECRET_REFRESH);
  });

  it("dos cifrados del mismo token son distintos (IV aleatorio)", () => {
    expect(encryptToken("t", "x")).not.toBe(encryptToken("t", "x"));
  });

  it("no se puede descifrar con otro AAD (otro usuario/negocio) ni con datos alterados", () => {
    const enc = encryptToken(SECRET_REFRESH, "biz-a:user-a");
    expect(() => decryptToken(enc, "biz-b:user-b")).toThrow();
    expect(() => decryptToken(enc.slice(0, -3) + "AAA", "biz-a:user-a")).toThrow();
    expect(() => decryptToken("basura", "biz-a:user-a")).toThrow();
  });

  it("sin clave configurada o con clave inválida falla", () => {
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "");
    expect(() => encryptToken("t", "x")).toThrow("google_encryption_not_configured");
    vi.stubEnv("GOOGLE_TOKEN_ENCRYPTION_KEY", "corta");
    expect(() => encryptToken("t", "x")).toThrow("google_encryption_key_invalid");
  });
});

describe("GoogleConnection", () => {
  it("crea la conexión guardando el refresh token CIFRADO", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: SECRET_REFRESH, scopes: ["openid", "email", GMAIL] });
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].refreshTokenEnc).not.toContain(SECRET_REFRESH);
    expect(decryptToken(db.rows[0].refreshTokenEnc!, "biz-a:user-a")).toBe(SECRET_REFRESH);
  });

  it("consulta el estado sin exponer nunca tokens", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: SECRET_REFRESH, scopes: [GMAIL] });
    const status = await getConnectionStatus(A);
    expect(status).toEqual({ connected: true, status: "active", googleEmail: "a@gmail.com", features: { gmail: true, calendar: false } });
    expect(JSON.stringify(status)).not.toContain(SECRET_REFRESH);
    expect(JSON.stringify(status)).not.toContain("v1.");
  });

  it("aislamiento por negocio y por usuario", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: "tok-a", scopes: [GMAIL] });
    expect((await getConnectionStatus(B)).connected).toBe(false);
    expect((await getConnectionStatus({ businessId: "biz-a", userId: "otro-usuario" })).connected).toBe(false);
    expect((await getConnectionStatus({ businessId: "biz-b", userId: "user-a" })).connected).toBe(false);
    await expect(getAccessToken(B)).rejects.toMatchObject({ code: "not_connected" });
  });

  it("un token cifrado copiado a la fila de otro usuario no sirve (AAD)", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: "tok-a", scopes: [GMAIL] });
    db.rows.push({ ...db.rows[0], id: "gc-x", businessId: "biz-b", userId: "user-b", googleEmail: "b@gmail.com" });
    await expect(getAccessToken(B)).rejects.toThrow();
  });

  it("obtiene un access token con el refresh token y lo cachea", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: SECRET_REFRESH, scopes: [GMAIL] });
    fetchMock.mockResolvedValue(jsonResponse({ access_token: "at-1", expires_in: 3600 }));

    expect(await getAccessToken(A, "gmail")).toBe("at-1");
    expect(await getAccessToken(A, "gmail")).toBe("at-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe(SECRET_REFRESH);
  });

  it("pide el scope faltante en vez de usar la conexión (Calendar sin autorizar)", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: "t", scopes: [GMAIL] });
    await expect(getAccessToken(A, "calendar")).rejects.toMatchObject({ code: "missing_scope" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("conexión revocada (invalid_grant): marca revoked, borra el token y pide reconectar", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: "t", scopes: [GMAIL] });
    fetchMock.mockResolvedValue(jsonResponse({ error: "invalid_grant" }, false, 400));

    await expect(getAccessToken(A)).rejects.toBeInstanceOf(GoogleConnectionError);
    expect(db.rows[0].status).toBe("revoked");
    expect(db.rows[0].refreshTokenEnc).toBeNull();
    expect(await getConnectionStatus(A)).toMatchObject({ connected: false, status: "revoked" });
  });

  it("desconectar revoca en Google, elimina la fila y el token", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: SECRET_REFRESH, scopes: [GMAIL] });
    fetchMock.mockResolvedValue(jsonResponse({}));

    expect(await disconnect(A)).toBe(true);
    expect(db.rows).toHaveLength(0);
    expect(fetchMock.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/revoke");
    expect((await getConnectionStatus(A)).connected).toBe(false);
  });

  it("desconectar no afecta la conexión de otro usuario/negocio", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: "ta", scopes: [GMAIL] });
    await saveConnection(B, { googleEmail: "b@gmail.com", refreshToken: "tb", scopes: [GMAIL] });
    fetchMock.mockResolvedValue(jsonResponse({}));
    await disconnect(A);
    expect(db.rows.map((r) => r.userId)).toEqual(["user-b"]);
  });

  it("desconectar sin conexión no falla y aunque Google no responda se borra el token local", async () => {
    expect(await disconnect(A)).toBe(false);
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: "t", scopes: [GMAIL] });
    fetchMock.mockRejectedValue(new Error("sin red"));
    expect(await disconnect(A)).toBe(true);
    expect(db.rows).toHaveLength(0);
  });
});

describe("OAuth — inicio, scopes e incremental", () => {
  it("la primera conexión de Gmail pide SOLO identidad + gmail.send (con offline e include_granted_scopes)", async () => {
    const result = await startConnect(A, "gmail", "/dashboard/negocio");
    if (!("url" in result)) throw new Error("se esperaba url");
    const url = new URL(result.url);
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("scope")).toBe(`openid email ${GMAIL}`);
    expect(url.searchParams.get("scope")).not.toContain("calendar");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    expect(url.searchParams.get("redirect_uri")).toBe("https://app.test/api/integrations/google/callback");
    expect(url.searchParams.get("login_hint")).toBeNull();
    expect(url.searchParams.get("state")).toBe(result.state);
  });

  it("Calendar es incremental: pide solo el scope de Calendar y fija la cuenta ya conectada", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: "t", scopes: ["openid", "email", GMAIL] });
    const result = await startConnect(A, "calendar", "/dashboard/configuracion/integraciones");
    if (!("url" in result)) throw new Error("se esperaba url");
    const url = new URL(result.url);
    expect(url.searchParams.get("scope")).toBe(`openid email ${CALENDAR}`);
    expect(url.searchParams.get("scope")).not.toContain("gmail");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
    expect(url.searchParams.get("login_hint")).toBe("a@gmail.com");
  });

  it("si el scope ya fue otorgado no vuelve a pedir autorización", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: "t", scopes: [GMAIL, CALENDAR] });
    expect(await startConnect(A, "gmail", "/x")).toEqual({ alreadyGranted: true });
    expect(await startConnect(A, "calendar", "/x")).toEqual({ alreadyGranted: true });
  });
});

describe("OAuth — state y callback", () => {
  async function begin(feature: "gmail" | "calendar" = "gmail", scope = A) {
    const result = await startConnect(scope, feature, "/dashboard/negocio");
    if (!("url" in result)) throw new Error("se esperaba url");
    return result;
  }
  const query = (params: Record<string, string>) => new URLSearchParams(params);
  const callback = (state: string, nonce: string | null, extra: Record<string, string> = { code: "code-1" }, scope = A) =>
    completeCallback({ scope, query: query({ state, ...extra }), cookieNonce: nonce, defaultReturnTo: "/dashboard/negocio" });

  const tokenOk = (email = "a@gmail.com", scopes = `openid email ${GMAIL}`, refresh: string | null = "rt-1") =>
    jsonResponse({ access_token: "at", refresh_token: refresh ?? undefined, scope: scopes, id_token: idToken(email) });

  it("state válido: firma, vencimiento y contenido", () => {
    const { state } = createOAuthState({ userId: "u", businessId: "b", feature: "gmail", returnTo: "/x" });
    expect(verifyOAuthState(state)).toMatchObject({ uid: "u", bid: "b", f: "gmail", rt: "/x" });
  });

  it("state inválido: alterado, sin firma, vencido o de otro secreto", () => {
    const { state } = createOAuthState({ userId: "u", businessId: "b", feature: "gmail", returnTo: "/x" });
    const [body] = state.split(".");
    expect(verifyOAuthState(`${body}.firma-falsa`)).toBeNull();
    expect(verifyOAuthState(state.replace(body, Buffer.from('{"uid":"otro"}').toString("base64url")))).toBeNull();
    expect(verifyOAuthState(null)).toBeNull();
    expect(verifyOAuthState("sin-punto")).toBeNull();

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    expect(verifyOAuthState(state)).toBeNull();
    vi.useRealTimers();

    vi.stubEnv("BETTER_AUTH_SECRET", "otro-secreto-otro-secreto-otro-12");
    expect(verifyOAuthState(state)).toBeNull();
  });

  it("callback exitoso: guarda la conexión con los scopes otorgados y el refresh token cifrado", async () => {
    const { state, nonce } = await begin();
    fetchMock.mockResolvedValue(tokenOk());

    const result = await callback(state, nonce);
    expect(result).toEqual({ ok: true, returnTo: "/dashboard/negocio", feature: "gmail" });
    expect(db.rows[0]).toMatchObject({ businessId: "biz-a", userId: "user-a", googleEmail: "a@gmail.com", status: "active" });
    expect(db.rows[0].scopes).toContain(GMAIL);
    expect(decryptToken(db.rows[0].refreshTokenEnc!, "biz-a:user-a")).toBe("rt-1");
    expect(JSON.stringify(result)).not.toContain("rt-1");
  });

  it("callback rechaza state inválido, cookie ausente o nonce distinto (CSRF) sin tocar Google", async () => {
    const { state, nonce } = await begin();
    expect((await callback("basura", nonce)).ok).toBe(false);
    expect(await callback(state, null)).toMatchObject({ ok: false, reason: "invalid_state" });
    expect(await callback(state, "otro-nonce")).toMatchObject({ ok: false, reason: "invalid_state" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.rows).toHaveLength(0);
  });

  it("callback rechaza un state emitido para OTRO usuario u otro negocio", async () => {
    const { state, nonce } = await begin("gmail", A);
    expect(await callback(state, nonce, { code: "c" }, B)).toMatchObject({ ok: false, reason: "wrong_user" });
    expect(await callback(state, nonce, { code: "c" }, { businessId: "biz-a", userId: "otro" })).toMatchObject({ ok: false, reason: "wrong_user" });
    expect(db.rows).toHaveLength(0);
  });

  it("cancelación: el usuario niega el permiso (error=access_denied) y no se guarda nada", async () => {
    const { state, nonce } = await begin();
    expect(await callback(state, nonce, { error: "access_denied" })).toMatchObject({ ok: false, reason: "cancelled" });
    expect(db.rows).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("si desmarca el permiso pedido en la pantalla de consentimiento no se conecta", async () => {
    const { state, nonce } = await begin();
    fetchMock.mockResolvedValue(tokenOk("a@gmail.com", "openid email"));
    expect(await callback(state, nonce)).toMatchObject({ ok: false, reason: "cancelled" });
    expect(db.rows).toHaveLength(0);
  });

  it("falla el intercambio del code: no se guarda nada", async () => {
    const { state, nonce } = await begin();
    fetchMock.mockResolvedValue(jsonResponse({ error: "invalid_grant" }, false, 400));
    expect(await callback(state, nonce)).toMatchObject({ ok: false, reason: "exchange_failed" });
    expect(db.rows).toHaveLength(0);
  });

  it("sin refresh token en la primera conexión se rechaza", async () => {
    const { state, nonce } = await begin();
    fetchMock.mockResolvedValue(tokenOk("a@gmail.com", `openid email ${GMAIL}`, null));
    expect(await callback(state, nonce)).toMatchObject({ ok: false, reason: "no_refresh_token" });
    expect(db.rows).toHaveLength(0);
  });

  it("autorización incremental de Calendar: conserva Gmail, suma Calendar y reutiliza el refresh token", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: "rt-original", scopes: ["openid", "email", GMAIL] });
    const { state, nonce } = await begin("calendar");
    // Google devuelve TODOS los scopes (include_granted_scopes) y, sin nuevo refresh token, se conserva el anterior.
    fetchMock.mockResolvedValue(tokenOk("a@gmail.com", `openid email ${GMAIL} ${CALENDAR}`, null));

    expect(await callback(state, nonce)).toMatchObject({ ok: true, feature: "calendar" });
    expect(db.rows).toHaveLength(1);
    expect(db.rows[0].scopes).toEqual(expect.arrayContaining([GMAIL, CALENDAR]));
    expect(decryptToken(db.rows[0].refreshTokenEnc!, "biz-a:user-a")).toBe("rt-original");
  });

  it("ampliar permisos con OTRA cuenta de Google se rechaza", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: "rt", scopes: [GMAIL] });
    const { state, nonce } = await begin("calendar");
    fetchMock.mockResolvedValue(tokenOk("otra@gmail.com", `openid email ${CALENDAR}`));
    expect(await callback(state, nonce)).toMatchObject({ ok: false, reason: "account_mismatch" });
    expect(db.rows[0].googleEmail).toBe("a@gmail.com");
  });

  it("reconectar tras una revocación reactiva la conexión", async () => {
    await saveConnection(A, { googleEmail: "a@gmail.com", refreshToken: "viejo", scopes: [GMAIL] });
    db.rows[0].status = "revoked";
    db.rows[0].refreshTokenEnc = null;

    const { state, nonce } = await begin();
    fetchMock.mockResolvedValue(tokenOk("nueva@gmail.com"));
    expect(await callback(state, nonce)).toMatchObject({ ok: true });
    expect(db.rows[0]).toMatchObject({ status: "active", googleEmail: "nueva@gmail.com" });
  });

  it("returnTo solo admite rutas internas (sin open redirect)", () => {
    expect(sanitizeReturnTo("/dashboard/x", "/f")).toBe("/dashboard/x");
    for (const bad of ["https://evil.com", "//evil.com", "javascript:alert(1)", "\\evil", 42, undefined]) {
      expect(sanitizeReturnTo(bad, "/f")).toBe("/f");
    }
  });
});
