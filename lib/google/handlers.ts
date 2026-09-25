import { NextResponse } from "next/server";

import { resolveGoogleContext, GOOGLE_RETURN_TO } from "./context";
import { disconnect, getConnectionStatus, isGoogleConfigured } from "./connection";
import { completeCallback, sanitizeReturnTo, startConnect } from "./oauth";
import { isGoogleFeature } from "./scopes";

// ═══ NÚCLEO GOOGLE COMPARTIDO (copia idéntica en nexo/ y crm/, salvo context.ts)
// Handlers de las 4 rutas /api/integrations/google/*. El usuario y el negocio
// salen SIEMPRE de resolveGoogleContext() (sesión); jamás del body/query.

const NONCE_COOKIE = "google_oauth_nonce";
const COOKIE_PATH = "/api/integrations/google";

const unauthenticated = () => NextResponse.json({ error: "unauthenticated" }, { status: 401 });

export async function statusHandler() {
  const ctx = await resolveGoogleContext();
  if (!ctx) return unauthenticated();
  const status = await getConnectionStatus(ctx);
  // Solo estado: nunca tokens.
  return NextResponse.json({ configured: isGoogleConfigured(), ...status });
}

export async function connectHandler(request: Request) {
  const ctx = await resolveGoogleContext();
  if (!ctx) return unauthenticated();
  if (!isGoogleConfigured()) return NextResponse.json({ error: "google_not_configured" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { feature?: unknown; returnTo?: unknown } | null;
  if (!isGoogleFeature(body?.feature)) return NextResponse.json({ error: "invalid_feature" }, { status: 400 });

  const result = await startConnect(ctx, body.feature, sanitizeReturnTo(body.returnTo, GOOGLE_RETURN_TO));
  if ("alreadyGranted" in result) return NextResponse.json({ alreadyGranted: true });

  const response = NextResponse.json({ url: result.url });
  response.cookies.set(NONCE_COOKIE, result.nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: COOKIE_PATH,
    maxAge: 600,
  });
  return response;
}

export async function callbackHandler(request: Request) {
  const redirectBase = process.env.GOOGLE_REDIRECT_URI ? new URL(process.env.GOOGLE_REDIRECT_URI).origin : new URL(request.url).origin;
  const ctx = await resolveGoogleContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", redirectBase));

  const cookieNonce = request.headers.get("cookie")?.match(new RegExp(`${NONCE_COOKIE}=([^;]+)`))?.[1] ?? null;
  const result = await completeCallback({
    scope: ctx,
    query: new URL(request.url).searchParams,
    cookieNonce,
    defaultReturnTo: GOOGLE_RETURN_TO,
  });

  const target = new URL(result.returnTo, redirectBase);
  target.searchParams.set("google", result.ok ? "connected" : result.reason);
  const response = NextResponse.redirect(target);
  response.cookies.set(NONCE_COOKIE, "", { path: COOKIE_PATH, maxAge: 0 });
  return response;
}

export async function disconnectHandler() {
  const ctx = await resolveGoogleContext();
  if (!ctx) return unauthenticated();
  await disconnect(ctx);
  return NextResponse.json({ ok: true });
}
