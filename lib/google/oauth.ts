import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { getClientConfig, getConnectionStatus, saveConnection, type GoogleScope, type GoogleTokenResponse } from "./connection";
import { hasFeature, scopesForFeature, type GoogleFeature } from "./scopes";
import { prisma } from "@/lib/prisma";
import { connectionAad, decryptToken } from "./crypto";

// ═══ NÚCLEO GOOGLE COMPARTIDO (copia idéntica en nexo/ y crm/) ═══════════════

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const STATE_TTL_MS = 10 * 60 * 1000;

export interface OAuthStatePayload {
  // Nonce aleatorio: también viaja en una cookie httpOnly (doble validación).
  n: string;
  uid: string;
  bid: string;
  f: GoogleFeature;
  rt: string;
  exp: number;
}

function stateSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("state_secret_not_configured");
  return secret;
}

function sign(body: string): string {
  return createHmac("sha256", stateSecret()).update(body).digest("base64url");
}

// Solo rutas internas relativas: evita open redirects tras el callback.
export function sanitizeReturnTo(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  return value;
}

export function createOAuthState(input: { userId: string; businessId: string; feature: GoogleFeature; returnTo: string }) {
  const nonce = randomBytes(16).toString("base64url");
  const payload: OAuthStatePayload = {
    n: nonce,
    uid: input.userId,
    bid: input.businessId,
    f: input.feature,
    rt: input.returnTo,
    exp: Date.now() + STATE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { state: `${body}.${sign(body)}`, nonce };
}

export function verifyOAuthState(state: string | null): OAuthStatePayload | null {
  if (!state) return null;
  const [body, signature] = state.split(".");
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthStatePayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

// Autorización incremental: se piden SOLO los scopes de la funcionalidad y
// include_granted_scopes hace que Google conserve los ya otorgados. login_hint
// fija la misma cuenta al ampliar permisos.
export function buildAuthorizationUrl(params: { state: string; feature: GoogleFeature; loginHint?: string | null }): string {
  const { clientId, redirectUri } = getClientConfig();
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopesForFeature(params.feature).join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", params.state);
  if (params.loginHint) url.searchParams.set("login_hint", params.loginHint);
  return url.toString();
}

async function exchangeCode(code: string): Promise<GoogleTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getClientConfig();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!response.ok || !data.access_token) throw new Error(data.error ?? `http_${response.status}`);
  return data;
}

// El id_token llega directo del endpoint de tokens de Google por TLS (no del
// navegador), así que alcanza con leer su payload.
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export type ConnectStart = { url: string; nonce: string; state: string } | { alreadyGranted: true };

// Inicia la conexión o la ampliación de permisos. Si el usuario ya tiene el
// scope pedido, NO se le vuelve a pedir autorización.
export async function startConnect(
  scope: GoogleScope,
  feature: GoogleFeature,
  returnTo: string
): Promise<ConnectStart> {
  const status = await getConnectionStatus(scope);
  if (status.connected && status.features[feature]) return { alreadyGranted: true };

  const { state, nonce } = createOAuthState({ userId: scope.userId, businessId: scope.businessId, feature, returnTo });
  const url = buildAuthorizationUrl({ state, feature, loginHint: status.googleEmail });
  return { url, nonce, state };
}

export type CallbackResult =
  | { ok: true; returnTo: string; feature: GoogleFeature }
  | { ok: false; reason: "cancelled" | "invalid_state" | "wrong_user" | "no_refresh_token" | "account_mismatch" | "exchange_failed"; returnTo: string };

// Callback: valida el state (firma, vencimiento, cookie y sesión actual) ANTES
// de tocar el code. El usuario/negocio salen del state firmado y se contrastan
// con la sesión: nunca de parámetros de la URL.
export async function completeCallback(params: {
  scope: GoogleScope;
  query: URLSearchParams;
  cookieNonce: string | null;
  defaultReturnTo: string;
}): Promise<CallbackResult> {
  const { scope, query, cookieNonce, defaultReturnTo } = params;

  const payload = verifyOAuthState(query.get("state"));
  if (!payload || !cookieNonce || payload.n !== cookieNonce) {
    return { ok: false, reason: "invalid_state", returnTo: defaultReturnTo };
  }
  const returnTo = sanitizeReturnTo(payload.rt, defaultReturnTo);
  if (payload.uid !== scope.userId || payload.bid !== scope.businessId) {
    return { ok: false, reason: "wrong_user", returnTo };
  }

  // El usuario canceló en la pantalla de Google (o Google devolvió un error).
  if (query.get("error")) return { ok: false, reason: "cancelled", returnTo };

  const code = query.get("code");
  if (!code) return { ok: false, reason: "cancelled", returnTo };

  let tokens: GoogleTokenResponse;
  try {
    tokens = await exchangeCode(code);
  } catch {
    return { ok: false, reason: "exchange_failed", returnTo };
  }

  const googleEmail = emailFromIdToken(tokens.id_token);
  if (!googleEmail) return { ok: false, reason: "exchange_failed", returnTo };

  const grantedScopes = (tokens.scope ?? "").split(" ").filter(Boolean);
  if (!hasFeature(grantedScopes, payload.f)) {
    // El usuario desmarcó el permiso en la pantalla de consentimiento.
    return { ok: false, reason: "cancelled", returnTo };
  }

  const existing = await prisma.googleConnection.findFirst({
    where: { businessId: scope.businessId, userId: scope.userId },
    select: { googleEmail: true, refreshTokenEnc: true, status: true },
  });

  // Ampliar permisos debe hacerse con la MISMA cuenta de Google.
  if (existing && existing.status === "active" && existing.googleEmail.toLowerCase() !== googleEmail.toLowerCase()) {
    return { ok: false, reason: "account_mismatch", returnTo };
  }

  // Google entrega refresh_token en la primera autorización (y con
  // prompt=consent, en las siguientes). Si no vino, se reutiliza el existente.
  let refreshToken = tokens.refresh_token;
  if (!refreshToken && existing?.refreshTokenEnc && existing.status === "active") {
    refreshToken = decryptToken(existing.refreshTokenEnc, connectionAad(scope.businessId, scope.userId));
  }
  if (!refreshToken) return { ok: false, reason: "no_refresh_token", returnTo };

  await saveConnection(scope, { googleEmail, refreshToken, scopes: grantedScopes });
  return { ok: true, returnTo, feature: payload.f };
}
