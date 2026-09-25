import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";
import type { GoogleScope } from "./connection";

// ESPECÍFICO DE NEXO (el CRM tiene su propia versión basada en
// resolveWorkspaceContext): resuelve usuario + negocio desde la sesión de
// Better Auth. Nunca desde datos enviados por el cliente.

// Pantalla a la que se vuelve tras autorizar (si no se pide otra).
export const GOOGLE_RETURN_TO = "/dashboard/negocio";

export async function resolveGoogleContext(): Promise<GoogleScope | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const membership = await prisma.membership.findFirst({ where: { userId: session.user.id } });
  if (!membership) return null;

  return { userId: session.user.id, businessId: membership.businessId };
}
