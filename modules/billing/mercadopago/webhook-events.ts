import { prisma } from "@/lib/prisma";

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

// true = evento nuevo, seguir procesando. false = ya se había procesado (el
// mismo id de notificación llegó de nuevo — MP reintenta hasta recibir 200)
// — responder 200 sin repetir ningún efecto secundario. Ver
// prisma/schema.prisma#MercadoPagoWebhookEvent.
export async function recordWebhookEventOnce(id: string, type: string): Promise<boolean> {
  try {
    await prisma.mercadoPagoWebhookEvent.create({ data: { id, type } });
    return true;
  } catch (error) {
    if (isUniqueConstraintError(error)) return false;
    throw error;
  }
}
