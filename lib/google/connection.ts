import { prisma } from "@/lib/prisma";
import { connectionAad, decryptToken, encryptToken } from "./crypto";
import { hasFeature, type GoogleFeature } from "./scopes";

// ═══ NÚCLEO GOOGLE COMPARTIDO (copia idéntica en nexo/ y crm/) ═══════════════
//
// Toda función recibe { businessId, userId } resueltos por el SERVIDOR desde la
// sesión; nunca de un dato del cliente. Una conexión solo la usa su propio
// usuario dentro de su propio negocio (clave única businessId + userId).

export interface GoogleScope {
  businessId: string;
  userId: string;
}

export interface ConnectionStatus {
  connected: boolean;
  // "revoked": Google/el usuario la revocó; hay que reconectar.
  status: "active" | "revoked" | null;
  googleEmail: string | null;
  features: Record<GoogleFeature, boolean>;
}

// Error tipado: la conexión ya no sirve (revocada o token inválido).
export class GoogleConnectionError extends Error {
  constructor(public code: "not_connected" | "revoked" | "missing_scope" | "google_error", message?: string) {
    super(message ?? code);
  }
}

export interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  error?: string;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export function getClientConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("google_oauth_not_configured");
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI &&
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  );
}

// Nunca devuelve el token: solo lo necesario para la UI.
export async function getConnectionStatus(scope: GoogleScope): Promise<ConnectionStatus> {
  const row = await prisma.googleConnection.findFirst({
    where: { businessId: scope.businessId, userId: scope.userId },
    select: { status: true, googleEmail: true, scopes: true },
  });
  if (!row) return { connected: false, status: null, googleEmail: null, features: { gmail: false, calendar: false } };
  const active = row.status === "active";
  return {
    connected: active,
    status: active ? "active" : "revoked",
    googleEmail: row.googleEmail,
    features: { gmail: active && hasFeature(row.scopes, "gmail"), calendar: active && hasFeature(row.scopes, "calendar") },
  };
}

export async function getActiveConnection(scope: GoogleScope) {
  return prisma.googleConnection.findFirst({
    where: { businessId: scope.businessId, userId: scope.userId, status: "active" },
  });
}

export type ConnectionRow = NonNullable<Awaited<ReturnType<typeof getActiveConnection>>>;

// Crea o actualiza la conexión (reconexión / autorización incremental). Los
// scopes que llegan son los TOTALES otorgados (include_granted_scopes).
export async function saveConnection(
  scope: GoogleScope,
  data: { googleEmail: string; refreshToken: string; scopes: string[] }
) {
  const refreshTokenEnc = encryptToken(data.refreshToken, connectionAad(scope.businessId, scope.userId));
  accessTokenCache.delete(`${scope.businessId}:${scope.userId}`);
  return prisma.googleConnection.upsert({
    where: { businessId_userId: { businessId: scope.businessId, userId: scope.userId } },
    create: { ...scope, googleEmail: data.googleEmail, refreshTokenEnc, scopes: data.scopes, status: "active" },
    update: { googleEmail: data.googleEmail, refreshTokenEnc, scopes: data.scopes, status: "active" },
  });
}

async function markRevoked(scope: GoogleScope) {
  accessTokenCache.delete(`${scope.businessId}:${scope.userId}`);
  await prisma.googleConnection.updateMany({
    where: { businessId: scope.businessId, userId: scope.userId },
    data: { status: "revoked", refreshTokenEnc: null },
  });
}

const accessTokenCache = new Map<string, { token: string; expiresAt: number }>();

// Access token efímero a partir del refresh token cifrado. No se persiste:
// solo se cachea en memoria hasta poco antes de vencer.
export async function getAccessToken(scope: GoogleScope, requiredFeature?: GoogleFeature): Promise<string> {
  const connection = await getActiveConnection(scope);
  if (!connection || !connection.refreshTokenEnc) throw new GoogleConnectionError("not_connected");
  if (requiredFeature && !hasFeature(connection.scopes, requiredFeature)) throw new GoogleConnectionError("missing_scope");

  const cacheKey = `${scope.businessId}:${scope.userId}`;
  const cached = accessTokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const refreshToken = decryptToken(connection.refreshTokenEnc, connectionAad(scope.businessId, scope.userId));
  const { clientId, clientSecret } = getClientConfig();

  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
  } catch {
    throw new GoogleConnectionError("google_error", "network_error");
  }

  const data = (await response.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!response.ok || !data.access_token) {
    // invalid_grant = el usuario revocó el acceso (o el token venció): la
    // conexión deja de servir y se pide reconectar. Nunca se loguea el token.
    if (data.error === "invalid_grant") {
      await markRevoked(scope);
      throw new GoogleConnectionError("revoked");
    }
    throw new GoogleConnectionError("google_error", data.error ?? `http_${response.status}`);
  }

  accessTokenCache.set(cacheKey, { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 });
  return data.access_token;
}

// Desconexión: revoca en Google (mejor esfuerzo) y BORRA la fila (y con ella el
// token cifrado). No toca ningún dato interno del producto ni los eventos ya
// creados en Google Calendar.
export async function disconnect(scope: GoogleScope): Promise<boolean> {
  const connection = await prisma.googleConnection.findFirst({
    where: { businessId: scope.businessId, userId: scope.userId },
  });
  if (!connection) return false;

  if (connection.refreshTokenEnc) {
    try {
      const token = decryptToken(connection.refreshTokenEnc, connectionAad(scope.businessId, scope.userId));
      await fetch(REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
    } catch {
      // Mejor esfuerzo: aunque Google no responda, se elimina el token local.
    }
  }

  accessTokenCache.delete(`${scope.businessId}:${scope.userId}`);
  await prisma.googleConnection.deleteMany({ where: { businessId: scope.businessId, userId: scope.userId } });
  return true;
}
