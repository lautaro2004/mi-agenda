import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

// Roles de una Membership (compartidos con Nodo, ver prisma/schema.prisma):
// owner = todo, incluida la facturación · admin = configuración del negocio,
// sin facturación · member = operación diaria (turnos, consultas, chats).
export type BusinessRole = "owner" | "admin" | "member";

const RANK: Record<BusinessRole, number> = { member: 1, admin: 2, owner: 3 };

export function normalizeRole(role: string | null | undefined): BusinessRole {
  return role === "owner" || role === "admin" ? role : "member";
}

export function hasRole(role: string | null | undefined, minRole: BusinessRole): boolean {
  return RANK[normalizeRole(role)] >= RANK[minRole];
}

export interface CurrentMembership {
  userId: string;
  businessId: string;
  role: BusinessRole;
}

// Membresía del usuario de la sesión CON acceso a Nexo (products incluye
// "nexo"). Un empleado al que el dueño solo le dio acceso a Nodo no
// resuelve ningún negocio acá: para Nexo es como si no tuviera negocio.
export async function getCurrentMembership(): Promise<CurrentMembership | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id, products: { has: "nexo" } },
    select: { businessId: true, role: true },
  });
  if (!membership) return null;

  return { userId: session.user.id, businessId: membership.businessId, role: normalizeRole(membership.role) };
}

// Único punto de entrada de las rutas de Nexo para saber "qué negocio".
// `minRole` restringe acciones: devuelve null (→ la ruta responde 401 como
// hoy) si el rol del usuario no alcanza. Sin `minRole`, cualquier miembro
// con acceso a Nexo — el comportamiento previo para los dueños no cambia.
export async function getCurrentBusinessId(options: { minRole?: BusinessRole } = {}): Promise<string | null> {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  if (options.minRole && !hasRole(membership.role, options.minRole)) return null;
  return membership.businessId;
}
