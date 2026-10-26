import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

// Auditoría del superadmin (nexo.AdminAuditLog): quién cambió qué, cuándo y
// por qué. Lo usan las rutas de planes/precios y de suscripciones. Nunca
// lanza: una falla de auditoría no deshace la operación, pero queda en el
// log del servidor.

export interface AdminAuditEntry {
  actorEmail: string;
  // ej. "plan.create", "plan.update", "subscription.assign", "subscription.benefit"
  action: string;
  entityType: "plan" | "subscription" | "promo_code";
  entityId: string;
  businessId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
}

// Nada sensible en before/after: los planes y suscripciones no guardan
// datos de tarjeta ni credenciales; igual se filtran claves por las dudas.
const SENSITIVE = /token|secret|password|card/i;
function scrub(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(
    JSON.stringify(value, (key, v) => (key && SENSITIVE.test(key) ? "[omitido]" : v instanceof Date ? v.toISOString() : v))
  ) as Prisma.InputJsonValue;
}

export async function logAdminAction(entry: AdminAuditEntry): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorEmail: entry.actorEmail,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        businessId: entry.businessId ?? null,
        reason: entry.reason?.trim() || null,
        before: scrub(entry.before),
        after: scrub(entry.after),
      },
    });
  } catch (error) {
    console.error("[audit] No se pudo registrar la acción del superadmin:", entry.action, entry.entityId, error);
  }
}

export async function listAuditForBusiness(businessId: string, limit = 50) {
  return prisma.adminAuditLog.findMany({ where: { businessId }, orderBy: { createdAt: "desc" }, take: limit });
}

export async function listAuditForEntity(entityType: string, entityId: string, limit = 50) {
  return prisma.adminAuditLog.findMany({ where: { entityType, entityId }, orderBy: { createdAt: "desc" }, take: limit });
}
