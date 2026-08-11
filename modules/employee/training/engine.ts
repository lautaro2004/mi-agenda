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
// dejar que la conversación quede esperando a que el dueño la empuje. Nunca
// se le muestra al dueño (el chat siempre renderiza su propio "Sí, guardalo
// así." fijo — ver components/ai-studio/training-chat.tsx), así que el
// contenido acá puede ser tan explícito como haga falta.
//
// Antes decía literalmente "Sí, guardalo así.", una frase corta que sonaba
// a una confirmación NUEVA — eso llevó a un bug real: justo después de
// guardar los servicios, el turno de continuación interpretó ese texto como
// pie para volver a proponer los mismos servicios (con descripciones más
// pobres), y esa segunda propuesta, al confirmarse, creó duplicados. La
// combinación con el unique constraint de Service (businessId+name) ya hace
// que eso sea inofensivo si vuelve a pasar, pero esto ataca la causa: le
// aclara al modelo que no hay nada nuevo que proponer.
export const CONTINUATION_MESSAGE =
  "(Mensaje del sistema: la propuesta anterior ya se guardó exitosamente en la base de datos. No la repitas ni la vuelvas a proponer. Continuá la conversación con naturalidad hacia la siguiente sección pendiente del plan, o cerrá la charla si ya no queda nada pendiente.)";

// Turno sintético análogo a CONTINUATION_MESSAGE, pero para cuando el dueño
// decide saltear la sección activa (botón "Completar después" — ver
// app/api/ai-studio/training-plan/[key]/skip/route.ts). El sistema ya la
// marcó "ignored" y activó la siguiente ANTES de este turno: la IA solo
// tiene que presentarla, no decidir nada.
export const SKIP_SECTION_MESSAGE =
  "(Mensaje del sistema: el dueño prefiere completar la sección activa más adelante. El sistema ya la marcó como 'ignored' y activó la siguiente sección pendiente, si existe — no vuelvas a preguntar por la que se saltó. Presentá la nueva sección activa con naturalidad y preguntá si quiere contarte sobre eso ahora o prefiere completarlo después también, o cerrá la charla si ya no queda nada pendiente.)";

function geminiProvider(): GeminiProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GeminiProvider(apiKey);
}

interface ParsedTrainingTurn {
  reply: string;
  proposal: TrainingProposal | null;
  // No-null únicamente cuando la IA SÍ intentó un bloque ```proposal``` (el
  // fence existe) pero no se pudo aplicar — JSON roto o no cumple
  // trainingProposalSchema. Es la señal que usa runTrainingTurn para pedirle
  // a la IA que se corrija en el mismo turno, en vez de dejar la propuesta
  // perdida en silencio (antes no había NINGÚN rastro de por qué se
  // descartaba, ni forma de recuperarse sin que el dueño repitiera todo).
  invalidProposalReason: string | null;
}

// Separa el texto que lee el dueño del bloque JSON que decide qué se persiste.
function parseTrainingTurn(raw: string): ParsedTrainingTurn {
  const match = raw.match(PROPOSAL_FENCE);
  const reply = (match ? raw.slice(0, match.index).trim() : raw.trim()) || "¿Podés contarme un poco más?";

  if (!match) return { reply, proposal: null, invalidProposalReason: null };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(match[1].trim());
  } catch (error) {
    const reason = `el bloque no es JSON válido (${error instanceof Error ? error.message : String(error)})`;
    console.error("[training] Bloque proposal con JSON inválido:", error, "\nRaw:", match[1]);
    return { reply, proposal: null, invalidProposalReason: reason };
  }

  const candidate = trainingProposalSchema.safeParse(parsedJson);
  if (!candidate.success) {
    const reason = candidate.error.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).join("; ");
    console.error("[training] Bloque proposal no cumple trainingProposalSchema:", candidate.error.flatten(), "\nRaw:", parsedJson);
    return { reply, proposal: null, invalidProposalReason: reason };
  }

  return { reply, proposal: candidate.data, invalidProposalReason: null };
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
  const firstParse = parseTrainingTurn(raw);
  let reply = firstParse.reply;
  let proposal = firstParse.proposal;
  const invalidProposalReason = firstParse.invalidProposalReason;

  if (invalidProposalReason) {
    // Caso general (cualquier kind: training_plan, training_plan_section o
    // knowledge_batch): la IA SÍ intentó proponer algo pero el bloque no se
    // pudo aplicar — se le devuelve el motivo EXACTO (ej. "items.2.data.
    // durationMinutes: La duración mínima es 5 minutos") para que lo corrija
    // en el mismo turno, en vez de perder la propuesta en silencio o confiar
    // en que el texto plano sea honesto sobre si algo se guardó.
    const correction = `Tu propuesta anterior no se pudo aplicar: ${invalidProposalReason}. Corregí el bloque \`\`\`proposal\`\`\` y volvé a mandarlo con el JSON arreglado, sin repetir el mismo error. No le digas al dueño que ya guardaste algo si no incluís un bloque válido en esta respuesta.`;

    const retryRaw = await provider.generateResponse(
      correction,
      [...geminiHistory, { role: "user", text: message }, { role: "model", text: raw }],
      prompt
    );
    const retry = parseTrainingTurn(retryRaw);

    if (retry.proposal) {
      reply = retry.reply;
      proposal = retry.proposal;
    } else {
      // Ni el reintento se corrigió: no dejamos pasar el texto original (que
      // puede estar narrando un guardado que nunca ocurrió) — se reemplaza
      // por algo honesto, la sección queda tal cual estaba, y se loguea todo
      // el intercambio para poder investigar por qué el modelo no logró
      // producir un bloque válido dos veces seguidas.
      console.error("[training] La propuesta siguió siendo inválida tras un reintento.", {
        businessId,
        raw,
        retryRaw,
        firstReason: invalidProposalReason,
        retryReason: retry.invalidProposalReason,
      });
      reply = "Tuve un problema guardando esa parte. ¿Podés repetirme la información en pocas palabras para intentarlo de nuevo?";
      proposal = null;
    }
  } else if (
    // Caso específico del Training Plan: acá no hubo NINGÚN bloque proposal
    // (no es que fallara, directamente no lo intentó), pero el texto ya
    // habla del plan como si existiera. Es el único caso donde "todavía no
    // hay plan" por sí solo NO alcanza como gatillo (eso es cierto en cada
    // turno normal de las primeras preguntas, antes de que el dueño diga el
    // rubro, y reintentar ahí presionaría al modelo a inventarlo).
    !context.trainingPlan &&
    proposal?.kind !== "training_plan" &&
    /training plan|plan de entrenamiento/i.test(reply)
  ) {
    const correction =
      'Tu respuesta anterior hablaba del Training Plan como si ya existiera, pero no incluiste el bloque ```proposal``` de kind "training_plan" que lo genera — el plan TODAVÍA no existe. Si ya tenés el rubro y una descripción breve del negocio (revisá el historial), generalo ahora mismo con ese formato exacto. Si en realidad todavía no te lo dijo, entonces pedíselo directamente en vez de hablar de un plan que no existe.';

    const retryRaw = await provider.generateResponse(
      correction,
      [...geminiHistory, { role: "user", text: message }, { role: "model", text: raw }],
      prompt
    );
    const retry = parseTrainingTurn(retryRaw);
    const retryStillClaimsPlanExists = /training plan|plan de entrenamiento/i.test(retry.reply);

    if (retry.proposal?.kind === "training_plan" || !retryStillClaimsPlanExists) {
      reply = retry.reply;
      proposal = retry.proposal;
    } else {
      console.error("[training] No se pudo generar un training_plan válido tras un reintento.", {
        businessId,
        raw,
        retryRaw,
      });
      reply = "Contame un poco más sobre tu negocio (a qué se dedica) para poder armarte el plan de entrenamiento.";
      proposal = null;
    }
  }

  await appendMessage(conversation.id, "assistant", reply);

  return { reply, proposal };
}
