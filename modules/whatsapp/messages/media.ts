import { downloadMediaMessage, getContentType, type WAMessage } from "baileys";

// Hasta esta feature, extractMessageText() (ver sync.ts) era la única lectura
// de mensajes entrantes, y para imageMessage/documentMessage solo devolvía un
// placeholder de texto ("[Imagen]") — nunca se descargaba el binario. Este
// módulo es el primero que sí lo hace, pensado específicamente para
// comprobantes de pago (ver modules/whatsapp/payments/inbound.ts). No cubre
// audio/video/sticker a propósito: un comprobante de transferencia nunca
// llega en esos formatos.
export type MediaKind = "image" | "document";

export interface IncomingMedia {
  kind: MediaKind;
  buffer: Buffer;
  mimeType: string;
  fileName: string | null;
}

export function getMessageMediaKind(message: WAMessage): MediaKind | null {
  const content = message.message;
  if (!content) return null;

  const type = getContentType(content);
  if (type === "imageMessage") return "image";
  if (type === "documentMessage") return "document";
  return null;
}

// null si no es un mensaje de imagen/documento, o si Baileys no pudo
// descargar el adjunto (link vencido, contenido corrupto, etc.) — el caller
// decide cómo responderle al cliente en ese caso, nunca se asume éxito.
export async function downloadIncomingMedia(message: WAMessage): Promise<IncomingMedia | null> {
  const kind = getMessageMediaKind(message);
  if (!kind) return null;

  const content = message.message;
  if (!content) return null;

  const mimeType = kind === "image" ? content.imageMessage?.mimetype : content.documentMessage?.mimetype;
  if (!mimeType) return null;

  const fileName = kind === "document" ? (content.documentMessage?.fileName ?? null) : null;

  try {
    const buffer = await downloadMediaMessage(message, "buffer", {});
    return { kind, buffer, mimeType, fileName };
  } catch (error) {
    console.error("[whatsapp/media] Error descargando adjunto:", error);
    return null;
  }
}
