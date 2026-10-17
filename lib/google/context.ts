import { getCurrentMembership } from "@/modules/business/current";
import type { GoogleScope } from "./connection";

// ESPECÍFICO DE NEXO (el CRM tiene su propia versión basada en
// resolveWorkspaceContext): resuelve usuario + negocio desde la sesión de
// Better Auth. Nunca desde datos enviados por el cliente.

// Pantalla a la que se vuelve tras autorizar (si no se pide otra).
export const GOOGLE_RETURN_TO = "/dashboard/negocio";

export async function resolveGoogleContext(): Promise<GoogleScope | null> {
  // Mismo criterio que el resto de Nexo: solo membresías con acceso a Nexo.
  const membership = await getCurrentMembership();
  if (!membership) return null;

  return { userId: membership.userId, businessId: membership.businessId };
}
