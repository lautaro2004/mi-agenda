import { prisma } from "@/lib/prisma";
import { getSubscriptionWithPlan, resolveAiAccess } from "@/modules/billing/subscription";
import { getLocalNow } from "@/modules/email/time";

// Créditos del chat web con IA: 1 crédito = 1 mensaje del cliente atendido por
// el modelo, contado en el mes calendario de Argentina contra Plan.aiCredits
// (configurable desde superadmin, sin tocar código). La segunda pasada del
// modelo (web_booking_chat_result) registra costo pero NO consume crédito.
// Cuando se agotan, el chat se degrada de forma controlada (ver la ruta): el
// formulario de reserva sigue funcionando.

export const WEB_CHAT_OPERATION = "web_booking_chat";

/** Inicio del mes calendario (hora de Argentina) como instante UTC. */
export function monthStart(now: Date = new Date()): Date {
  const { date } = getLocalNow(now);
  return new Date(`${date.slice(0, 8)}01T00:00:00-03:00`);
}

export interface ChatCredits {
  allowed: boolean;
  /** -1 = sin tope (no debería ocurrir con plan asignado). */
  limit: number;
  used: number;
  remaining: number;
}

export function computeChatCredits(limit: number, used: number, allowed: boolean): ChatCredits {
  if (limit < 0) return { allowed, limit, used, remaining: Number.POSITIVE_INFINITY };
  return { allowed: allowed && limit > 0, limit, used, remaining: Math.max(0, limit - used) };
}

export async function getChatCredits(businessId: string, now: Date = new Date()): Promise<ChatCredits> {
  const sub = await getSubscriptionWithPlan(businessId);
  const access = resolveAiAccess(sub);
  const used = await prisma.aiUsageEvent.count({
    where: { businessId, operation: WEB_CHAT_OPERATION, success: true, createdAt: { gte: monthStart(now) } },
  });
  return computeChatCredits(access.limit, used, access.allowed);
}
