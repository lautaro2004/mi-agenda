import { prisma } from "@/lib/prisma";
import { DEFAULT_TIME_ZONE, isValidTimeZone, resolveTimeZone } from "@/lib/time-zone";

// Zona horaria del negocio. Nunca lanza: si falla la lectura (por ejemplo la
// migración todavía no corrió) se usa la de Argentina, como hasta ahora.
export async function getBusinessTimeZone(businessId: string): Promise<string> {
  try {
    const row = await prisma.business.findUnique({ where: { id: businessId }, select: { timeZone: true } });
    return resolveTimeZone(row?.timeZone);
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

// Devuelve false si el negocio no existe o la zona no es válida.
export async function setBusinessTimeZone(businessId: string, timeZone: string): Promise<boolean> {
  if (!isValidTimeZone(timeZone)) return false;
  const res = await prisma.business.updateMany({ where: { id: businessId }, data: { timeZone } });
  return res.count > 0;
}
