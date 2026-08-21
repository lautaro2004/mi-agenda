import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const runtime = "nodejs";

// /superadmin solo obtiene acá el mismo chequeo barato de "hay cookie de
// sesión" que /dashboard — esto NO es la verificación de superadmin (eso
// requiere DB y el allowlist de SUPERADMIN_EMAILS, ver
// lib/auth/superadmin.ts, que corre en el layout y en cada ruta de API).
// Sin esto, un visitante sin sesión llegaría hasta el layout antes de ser
// redirigido; con esto, se corta antes.
export const config = {
  matcher: ["/dashboard/:path*", "/superadmin/:path*"],
};
