import { getContentType, jidNormalizedUser, type WAMessage } from "baileys";

import type { ConversationMessage, MessageSender } from "@/lib/types";
import { conversationRepository } from "@/modules/whatsapp/conversations/repository";

export function extractMessageText(message: WAMessage): string {
  const content = message.message;
  if (!content) return "";

  const type = getContentType(content);
  switch (type) {
    case "conversation":
      return content.conversation ?? "";
    case "extendedTextMessage":
      return content.extendedTextMessage?.text ?? "";
    case "imageMessage":
      return content.imageMessage?.caption ?? "[Imagen]";
    case "videoMessage":
      return content.videoMessage?.caption ?? "[Video]";
    case "audioMessage":
      return "[Audio]";
    case "documentMessage":
      return content.documentMessage?.caption ?? content.documentMessage?.fileName ?? "[Documento]";
    case "stickerMessage":
      return "[Sticker]";
    case "locationMessage":
      return "[Ubicación]";
    default:
      return "[Mensaje no soportado]";
  }
}

// WhatsApp (multi-dispositivo) identifica a algunos contactos con un "LID":
// un identificador interno que NO es su teléfono. Si se lo formatea como
// número queda un valor largo y falso (ej. +128969311527129).
export function isLidJid(jid: string): boolean {
  return jid.endsWith("@lid") || jid.endsWith("@hosted.lid");
}

// Teléfono legible del contacto, o "" si el JID no corresponde a uno real
// (LID sin resolver): nunca se muestra un número inventado.
export function formatPhoneFromJid(jid: string): string {
  if (isLidJid(jid)) return "";
  const normalized = jidNormalizedUser(jid);
  const number = normalized.split("@")[0];
  return `+${number}`;
}

export function fallbackContactName(jid: string): string {
  return formatPhoneFromJid(jid) || "Contacto de WhatsApp";
}

// Si el chat viene identificado por LID, lo reemplaza por el JID con el
// teléfono real cuando WhatsApp lo informa (remoteJidAlt) o cuando el mapeo
// LID→teléfono ya está guardado en la sesión. Sin resolver, queda el LID.
export async function resolvePhoneJid(
  waMessage: WAMessage,
  lookup?: (lid: string) => Promise<string | null | undefined>
): Promise<void> {
  const jid = waMessage.key.remoteJid;
  if (!jid || !isLidJid(jid)) return;

  let pn: string | null | undefined = waMessage.key.remoteJidAlt;
  if (!pn && lookup) {
    try {
      pn = await lookup(jid);
    } catch {
      pn = null;
    }
  }
  if (pn && pn.endsWith("@s.whatsapp.net")) waMessage.key.remoteJid = jidNormalizedUser(pn);
}

// Inversa de formatPhoneFromJid: reconstruye el JID a partir del teléfono
// guardado en Appointment.customerPhone para poder mandarle un mensaje
// (confirmación/rechazo de pago, ver modules/payments/service.ts) sin
// depender de que la conversación siga viva en el Map en memoria.
export function phoneToJid(phone: string): string {
  return `${phone.replace(/^\+/, "")}@s.whatsapp.net`;
}

export function syncIncomingMessage(businessId: string, waMessage: WAMessage): void {
  if (!waMessage.message) return;

  const jid = waMessage.key.remoteJid;
  if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") return;

  const text = extractMessageText(waMessage);
  if (!text) return;

  const fromMe = waMessage.key.fromMe ?? false;
  const sender: MessageSender = fromMe ? "business" : "customer";
  const timestampSeconds =
    typeof waMessage.messageTimestamp === "number"
      ? waMessage.messageTimestamp
      : Number(waMessage.messageTimestamp ?? Date.now() / 1000);

  const conversation = conversationRepository.ensureConversation({
    id: jid,
    businessId,
    contactName: waMessage.pushName || fallbackContactName(jid),
    contactPhone: formatPhoneFromJid(jid),
  });

  const message: ConversationMessage = {
    id: waMessage.key.id || `${jid}-${timestampSeconds}`,
    sender,
    text,
    timestamp: new Date(timestampSeconds * 1000).toISOString(),
  };

  conversationRepository.addMessage(businessId, conversation.id, message, !fromMe);
}
