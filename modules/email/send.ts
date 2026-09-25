import { prisma } from "@/lib/prisma";
import { getActiveConnection } from "@/lib/google/connection";
import { hasFeature } from "@/lib/google/scopes";
import { sendViaGmail } from "./gmail";
import { sendViaResend, type OutgoingEmail, type SendResult } from "./provider";

// Email PROPIO de la plataforma (avisos al dueño, resumen diario, cuenta): sale
// siempre por Resend con el remitente de Kodexa.
export function sendPlatformEmail(message: OutgoingEmail): Promise<SendResult> {
  return sendViaResend(message);
}

async function getOwner(businessId: string): Promise<{ userId: string; email: string } | null> {
  const membership = await prisma.membership.findFirst({
    where: { businessId, role: "owner" },
    orderBy: { createdAt: "asc" },
    select: { userId: true, user: { select: { email: true } } },
  });
  return membership ? { userId: membership.userId, email: membership.user.email } : null;
}

// El dueño se resuelve siempre en el servidor a partir del negocio, nunca de
// un dato del cliente.
export async function getOwnerEmail(businessId: string): Promise<string | null> {
  return (await getOwner(businessId))?.email ?? null;
}

// Email EN NOMBRE DEL NEGOCIO (confirmación/recordatorio al cliente).
//
// Canal: si el DUEÑO del negocio conectó su Gmail (GoogleConnection activa con
// el scope de envío), sale por Gmail desde su cuenta. Si no hay conexión, o
// Gmail falla (token revocado, error de Google), cae a Resend con el nombre del
// negocio como remitente visible y Reply-To al dueño, de modo que el negocio
// nunca configura dominio ni DNS. La interfaz no cambia: quien llama no sabe qué
// canal se usó. La idempotencia sigue en los llamadores (marcas en la base) y,
// para Resend, en idempotencyKey.
export async function sendBusinessEmail(params: {
  businessId: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  idempotencyKey?: string;
}): Promise<SendResult> {
  const { businessId, replyTo, ...message } = params;
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
  const owner = await getOwner(businessId);

  if (owner) {
    // Solo la conexión del dueño del PROPIO negocio: nunca la de otro negocio.
    const connection = await getActiveConnection({ businessId, userId: owner.userId });
    if (connection && hasFeature(connection.scopes, "gmail")) {
      const viaGmail = await sendViaGmail(
        { businessId, userId: owner.userId },
        {
          fromEmail: connection.googleEmail,
          fromName: business?.name,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
          replyTo,
        }
      );
      if (viaGmail.ok) return viaGmail;
      console.error("[email] Gmail falló, se usa Resend como respaldo:", viaGmail.error);
    }
  }

  return sendViaResend({
    ...message,
    fromName: business?.name,
    replyTo: replyTo ?? owner?.email,
  });
}
