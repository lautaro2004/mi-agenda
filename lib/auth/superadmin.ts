import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";

// No existe ningún concepto de rol/admin en el resto del sistema (Membership.role
// es siempre "owner", nunca se lee en ningún lado). En vez de forzar una
// migración de esquema para algo que hoy es "quién es el dueño de la
// plataforma" (no un RBAC general), esto se resuelve con un allowlist de
// emails por variable de entorno. Fail-closed a propósito: si SUPERADMIN_EMAILS
// no está configurada, NADIE tiene acceso — nunca "todos tienen acceso" por
// una config faltante.
function superadminEmails(): Set<string> {
  const raw = process.env.SUPERADMIN_EMAILS ?? "";
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export interface SuperadminSession {
  userId: string;
  email: string;
  name: string;
}

// Único punto de verificación — tanto el layout de /superadmin como cada
// ruta bajo /api/superadmin llaman a esto de forma independiente (nunca se
// confía en que el layout ya haya validado: una API sin este chequeo propio
// sería alcanzable directo, sin pasar por ninguna pantalla).
export async function getSuperadminSession(): Promise<SuperadminSession | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const allowlist = superadminEmails();
  if (allowlist.size === 0) return null;
  if (!allowlist.has(session.user.email.toLowerCase())) return null;

  return { userId: session.user.id, email: session.user.email, name: session.user.name };
}
