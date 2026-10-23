import { prisma } from "@/lib/prisma";
import { ACK_RE, EMOJI_ONLY_RE, MEDIA_PLACEHOLDER_RE } from "@/modules/ai/triage/classifier";
import { createInquiry } from "@/modules/inquiries/service";
import { isLeadQualificationActive } from "@/modules/inquiries/qualification";
import { WHATSAPP_LEAD_WINDOW_DAYS } from "@/modules/inquiries/whatsapp-lead-constants";

export { WHATSAPP_LEAD_WINDOW_DAYS };

// ¿El mensaje tiene contenido real? Mismos criterios que el triage de la IA
// (modules/ai/triage/classifier.ts) para "no hay nada que responder": un
// "hola", un emoji, un sticker o un audio sin texto todavía no dicen nada.
// Se espera al primer mensaje con contenido para crear la consulta — así el
// texto que ve el dueño (o Nodo) es la consulta real, no un saludo.
export function isMeaningfulLeadMessage(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 3) return false;
  if (MEDIA_PLACEHOLDER_RE.test(trimmed)) return false;
  if (EMOJI_ONLY_RE.test(trimmed)) return false;
  if (ACK_RE.test(trimmed)) return false;
  return true;
}

interface CaptureInput {
  businessId: string;
  // JID de la conversación: mismo conversationRef que usa el asistente
  // (capture.ts), así si después el asistente registra al interesado,
  // actualiza esta misma consulta en vez de crear otra.
  conversationRef: string;
  contactName: string;
  contactPhone: string;
  text: string;
}

// Evita que dos mensajes seguidos del mismo número (llegan casi juntos, y el
// chequeo + insert no son atómicos) creen dos consultas. Solo protege dentro
// de este proceso — suficiente: la conexión de WhatsApp de un negocio vive
// en un único proceso (ver whatsappConnectionManager).
const inFlight = new Set<string>();

// Detección de leads de WhatsApp. Corre para TODO mensaje entrante de un
// cliente, con la IA prendida o apagada (modo manual): detectar un lead no es
// responder. Cada lead queda como Consulta (source "whatsapp") en Nexo; si el
// negocio tiene Nodo, la sincronización del CRM la levanta desde ahí — Nexo
// nunca escribe en crm.* (ver docs/architecture/crm-fase4-nexo-leads.md).
//
// Calificación (etapa 2): si el negocio la tiene activa, la consulta nace
// "pending" — Nodo no la sincroniza hasta que la IA (o el dueño) la marque
// "qualified". El análisis en sí lo dispara el manejador de WhatsApp (ver
// scheduleLeadQualification en qualification.ts).
export async function captureWhatsappLead(input: CaptureInput): Promise<"created" | "skipped"> {
  if (!input.contactPhone || !isMeaningfulLeadMessage(input.text)) return "skipped";

  const key = `${input.businessId}:${input.contactPhone}`;
  if (inFlight.has(key)) return "skipped";
  inFlight.add(key);

  try {
    const since = new Date(Date.now() - WHATSAPP_LEAD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const existing = await prisma.inquiry.findFirst({
      where: {
        businessId: input.businessId,
        customerWhatsapp: input.contactPhone,
        // channel (no source): también cubre las que registró el asistente.
        channel: "whatsapp",
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (existing) return "skipped";

    const qualificationActive = await isLeadQualificationActive(input.businessId);

    await createInquiry({
      businessId: input.businessId,
      customerName: input.contactName || input.contactPhone,
      customerWhatsapp: input.contactPhone,
      customerEmail: null,
      message: input.text.trim().slice(0, 2000),
      source: "whatsapp",
      channel: "whatsapp",
      conversationRef: input.conversationRef,
      ...(qualificationActive ? { qualificationStatus: "pending" as const } : {}),
    });
    return "created";
  } finally {
    inFlight.delete(key);
  }
}
