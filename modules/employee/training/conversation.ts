import { prisma } from "@/lib/prisma";
import type { TrainingMode } from "@/modules/ai/prompt/training";

// Persistencia de la CONVERSACIÓN de entrenamiento — deliberadamente separada
// del CONOCIMIENTO (Business, Service, MemoryEntry, EmployeeGoal/Restriction,
// TrainingPlanSection). Guardar el chat no significa que la información ya
// quedó aplicada: eso sigue pasando únicamente vía proposal.ts. Esto solo
// garantiza que la charla en sí nunca se pierda, aunque la IA no llegue a
// proponer nada.
//
// No reutiliza el modelo de conversaciones de WhatsApp (modules/whatsapp/*):
// son conceptos distintos, con su propio ciclo de vida.

export type TrainingMessageRole = "user" | "assistant";

interface RawMessage {
  role: TrainingMessageRole;
  content: string;
}

export interface TrainingChatMessage {
  role: "owner" | "ai";
  text: string;
}

function toClientMessage(m: RawMessage): TrainingChatMessage {
  return { role: m.role === "user" ? "owner" : "ai", text: m.content };
}

// Un negocio mantiene una única conversación "viva" por modo (onboarding /
// continuous): no hay UI para iniciar hilos paralelos, así que se retoma
// siempre la más reciente en vez de crear una nueva cada vez.
export async function getOrCreateConversation(businessId: string, mode: TrainingMode): Promise<{ id: string }> {
  const existing = await prisma.trainingConversation.findFirst({
    where: { businessId, mode },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.trainingConversation.create({
    data: { businessId, mode },
    select: { id: true },
  });
}

// Historial "crudo" (role: user/assistant) para alimentar a Gemini.
export async function getRawMessages(conversationId: string): Promise<RawMessage[]> {
  const rows = await prisma.trainingMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({ role: r.role as TrainingMessageRole, content: r.content }));
}

export async function appendMessage(
  conversationId: string,
  role: TrainingMessageRole,
  content: string
): Promise<void> {
  await prisma.trainingMessage.create({ data: { conversationId, role, content } });
  // @updatedAt no se dispara solo por crear un mensaje relacionado: se toca
  // a mano para que getOrCreateConversation siga encontrando esta conversación
  // como "la más reciente" en la próxima interacción.
  await prisma.trainingConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });
}

// Historial en formato cliente (role: owner/ai), para rehidratar el chat al
// cargar la página — así una recarga o un cambio de pestaña ya no borra la
// conversación.
export async function getClientMessages(businessId: string, mode: TrainingMode): Promise<TrainingChatMessage[]> {
  const conversation = await prisma.trainingConversation.findFirst({
    where: { businessId, mode },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!conversation) return [];

  const messages = await getRawMessages(conversation.id);
  return messages.map(toClientMessage);
}
