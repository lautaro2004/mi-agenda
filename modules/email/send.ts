import { prisma } from "@/lib/prisma";
import { sendViaResend, type OutgoingEmail, type SendResult } from "./provider";

// Email PROPIO de la plataforma (avisos al dueño, resumen diario, etc.): sale
// siempre por Resend con el remitente de Kodexa.
export function sendPlatformEmail(message: OutgoingEmail): Promise<SendResult> {
  return sendViaResend(message);
}

// El dueño se resuelve siempre en el servidor a partir del negocio, nunca de
// un dato del cliente.
export async function getOwnerEmail(businessId: string): Promise<string | null> {
  const membership = await prisma.membership.findFirst({
    where: { businessId, role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { email: true } } },
  });
  return membership?.user.email ?? null;
}

// Email EN NOMBRE DEL NEGOCIO (confirmación/recordatorio al cliente). Hoy sale
// por Resend con el nombre del negocio como remitente visible y Reply-To al
// dueño — el negocio no configura dominio ni DNS. Es el único punto de envío
// de este tipo: cuando exista GoogleConnection (fase 3), acá se elige Gmail si
// el negocio lo conectó y se cae a Resend si no, sin tocar a los llamadores.
export async function sendBusinessEmail(params: {
  businessId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  idempotencyKey?: string;
}): Promise<SendResult> {
  const { businessId, ...message } = params;
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
  const ownerEmail = await getOwnerEmail(businessId);
  return sendViaResend({
    ...message,
    fromName: business?.name,
    replyTo: ownerEmail ?? undefined,
  });
}
