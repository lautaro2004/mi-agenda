import type { Conversation } from "@/lib/types";

export const AI_DISCLOSURE_TEXT =
  "🤖 Te atiende el asistente virtual (IA) de este negocio. Si preferís hablar con una persona, escribí \"quiero hablar con una persona\".";

// Se informa una sola vez por conversación: mientras la IA no haya respondido
// nada todavía en ella, la primera respuesta automática lleva el aviso
// adelante. Sin estado nuevo: se deriva de los mensajes ya guardados (si el
// proceso se reinicia y la conversación se pierde, se vuelve a avisar, que es
// el error seguro).
export function needsAiDisclosure(conversation: Pick<Conversation, "messages">): boolean {
  return !conversation.messages.some((m) => m.sender === "ai");
}

export function withAiDisclosure(conversation: Pick<Conversation, "messages">, text: string): string {
  return needsAiDisclosure(conversation) ? `${AI_DISCLOSURE_TEXT}\n\n${text}` : text;
}
