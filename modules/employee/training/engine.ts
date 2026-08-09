import { GeminiProvider } from "@/modules/ai/providers/gemini";
import { buildTrainingPrompt, type TrainingMode } from "@/modules/ai/prompt/training";
import { buildBusinessContext } from "@/modules/employee/context";
import { activateNextPendingSection } from "@/modules/employee/training-plan";
import { appendMessage, getOrCreateConversation, getRawMessages } from "@/modules/employee/training/conversation";
import { trainingProposalSchema, type TrainingProposal } from "@/modules/employee/training/proposal";

export type { TrainingMode };
export type { TrainingChatMessage } from "@/modules/employee/training/conversation";

export interface TrainingTurnResult {
  reply: string;
  proposal: TrainingProposal | null;
}

const PROPOSAL_FENCE = /```proposal\s*([\s\S]*?)```/;

const UNAVAILABLE_REPLY =
  "El entrenamiento por chat no está disponible en este momento. Probá de nuevo más tarde.";

// Turno sintético usado por /api/ai-studio/training/apply para pedirle a la IA
// que continúe inmediatamente después de guardar una propuesta, en vez de
// dejar que la conversación quede esperando a que el dueño la empuje.
export const CONTINUATION_MESSAGE = "Sí, guardalo así.";

function geminiProvider(): GeminiProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GeminiProvider(apiKey);
}

// El historial ya no lo manda el cliente: el servidor es la única fuente de
// verdad (ver modules/employee/training/conversation.ts). Esto evita que la
// charla dependa de que el navegador siga vivo con el estado correcto, y
// hace que exchangeCount (usado para forzar el cierre de una sección) sea
// exacto en vez de una aproximación.
export async function runTrainingTurn(params: {
  businessId: string;
  mode: TrainingMode;
  message: string;
}): Promise<TrainingTurnResult> {
  const { businessId, mode, message } = params;

  const provider = geminiProvider();
  if (!provider) {
    return { reply: UNAVAILABLE_REPLY, proposal: null };
  }

  // Único punto de activación de la "sección activa" (currentSection): idempotente,
  // no hace nada si ya hay una en progreso o si todavía no existe plan.
  // Garantiza, sin depender del modelo, que siempre haya un tema claro sobre
  // el que preguntar en este turno.
  await activateNextPendingSection(businessId);

  const conversation = await getOrCreateConversation(businessId, mode);
  const priorMessages = await getRawMessages(conversation.id);
  await appendMessage(conversation.id, "user", message);

  const context = await buildBusinessContext(businessId);
  const prompt = buildTrainingPrompt(context, mode, priorMessages.length);

  const geminiHistory = priorMessages.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    text: m.content,
  }));

  const raw = await provider.generateResponse(message, geminiHistory, prompt);

  const match = raw.match(PROPOSAL_FENCE);
  const reply = (match ? raw.slice(0, match.index).trim() : raw.trim()) || "¿Podés contarme un poco más?";

  let proposal: TrainingProposal | null = null;
  if (match) {
    try {
      const candidate = trainingProposalSchema.safeParse(JSON.parse(match[1].trim()));
      if (candidate.success) proposal = candidate.data;
    } catch {
      // La IA emitió un bloque "proposal" inválido; se ignora y solo se muestra el texto.
    }
  }

  await appendMessage(conversation.id, "assistant", reply);

  return { reply, proposal };
}
