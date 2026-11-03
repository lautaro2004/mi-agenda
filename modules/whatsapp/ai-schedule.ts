import { prisma } from "@/lib/prisma";
import { DEFAULT_AI_SCHEDULE, aiMayReply, aiScheduleSchema, resolveAiSchedule, type AiSchedule } from "@/lib/ai-schedule";
import { getBusinessTimeZone } from "@/modules/business/time-zone";

// El worker de WhatsApp y el panel son procesos distintos que comparten la
// base: el horario se lee SIEMPRE de la base (con un cache corto), así un
// cambio hecho en el panel aplica sin reiniciar el worker.
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; schedule: AiSchedule; tz: string }>();

export async function getAiSchedule(businessId: string): Promise<AiSchedule> {
  try {
    const row = await prisma.business.findUnique({ where: { id: businessId }, select: { whatsappAiSchedule: true } });
    return resolveAiSchedule(row?.whatsappAiSchedule);
  } catch {
    return DEFAULT_AI_SCHEDULE;
  }
}

export async function saveAiSchedule(businessId: string, input: unknown): Promise<AiSchedule | null> {
  const parsed = aiScheduleSchema.safeParse(input);
  if (!parsed.success) return null;
  await prisma.business.update({ where: { id: businessId }, data: { whatsappAiSchedule: parsed.data } });
  cache.delete(businessId);
  return parsed.data;
}

// Nunca lanza: ante cualquier error, la IA responde (como antes del horario).
export async function aiAllowedNow(businessId: string, now: Date = new Date()): Promise<boolean> {
  try {
    let entry = cache.get(businessId);
    if (!entry || now.getTime() - entry.at > CACHE_MS) {
      const [schedule, tz] = await Promise.all([getAiSchedule(businessId), getBusinessTimeZone(businessId)]);
      entry = { at: now.getTime(), schedule, tz };
      cache.set(businessId, entry);
    }
    return aiMayReply(entry.schedule, now, entry.tz);
  } catch {
    return true;
  }
}
