// import type se borra en la compilación (no rompe el guard de runtime de
// abajo, que evita cargar código de Node en Edge): solo se usa para anclar
// el tipo del resultado de business.findMany() a lo que devuelve ese select
// puntual, en vez de depender de que la inferencia genérica del método lo
// resuelva sola.
import type { Prisma } from "@prisma/client";

type BusinessIdOnly = Prisma.BusinessGetPayload<{ select: { id: true } }>;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { whatsappConnectionManager } = await import("@/modules/whatsapp/connection/manager");
  const { prisma } = await import("@/lib/prisma");

  try {
    const businesses: BusinessIdOnly[] = await prisma.business.findMany({ select: { id: true } });
    await Promise.all(businesses.map(({ id }) => whatsappConnectionManager.restore(id)));
  } catch (error) {
    // La base puede no estar disponible en el momento exacto del arranque
    // (conexión inestable, cold start del pooler, etc.). No queremos que un
    // hipo transitorio tumbe todo el servidor: se loguea y se sigue. Las
    // sesiones de WhatsApp no se restauran automáticamente en ese arranque,
    // pero se pueden reconectar manualmente desde el dashboard.
    console.error("[instrumentation] No se pudieron restaurar las sesiones de WhatsApp al arrancar:", error);
  }
}
