import { prisma } from "@/lib/prisma";
import { parseStoredRules, type SmartBookingRules } from "@/lib/smart-booking";

// Persistencia de las reglas de agenda inteligente (una fila por negocio).
// Este módulo SOLO lee/guarda: la validación del plan (canUseSmartBooking) y
// del rol (admin) se hace en el punto de entrada, nunca acá.
//
// Perder el plan NO borra las reglas: quedan guardadas y simplemente dejan de
// aplicarse (ver getActiveSmartBookingRules).

export async function getSmartBookingRules(businessId: string): Promise<{ rules: SmartBookingRules; instructions: string | null; updatedAt: Date | null }> {
  const row = await prisma.smartBookingRules.findUnique({ where: { businessId } });
  return { rules: parseStoredRules(row?.rules, row?.mode), instructions: row?.instructions ?? null, updatedAt: row?.updatedAt ?? null };
}

export async function saveSmartBookingRules(
  businessId: string,
  rules: SmartBookingRules,
  options: { instructions?: string | null; userId?: string | null } = {}
) {
  const { mode, ...rest } = rules;
  const data = {
    mode,
    rules: rest,
    ...(options.instructions !== undefined ? { instructions: options.instructions } : {}),
    updatedByUserId: options.userId ?? null,
  };
  return prisma.smartBookingRules.upsert({ where: { businessId }, create: { businessId, ...data }, update: data });
}
