import { GeminiProvider } from "@/modules/ai/providers/gemini";
import { buildTrainingPrompt, type TrainingMode } from "@/modules/ai/prompt/training";
import { buildBusinessContext } from "@/modules/employee/context";
import { activateNextPendingSection, ignoreRemainingSections } from "@/modules/employee/training-plan";
import { appendMessage, getOrCreateConversation, getRawMessages } from "@/modules/employee/training/conversation";
import { trainingProposalSchema, type TrainingProposal } from "@/modules/employee/training/proposal";
import { getAiResponseLimit } from "@/lib/ai-limits";
import type { AiUsageMeta } from "@/modules/ai/usage";

export type { TrainingMode };
export type { TrainingChatMessage } from "@/modules/employee/training/conversation";

export interface TrainingTurnResult {
  reply: string;
  proposal: TrainingProposal | null;
  // true cuando esta respuesta salió del corte duro del backend (ver
  // getAiResponseLimit) y NO se llegó a llamar a Gemini: el frontend la usa
  // para deshabilitar el input y ofrecer ir al dashboard en vez de dejar que
  // el dueño siga escribiendo contra una conversación ya cerrada.
  limitReached: boolean;
}

const PROPOSAL_FENCE = /```proposal\s*([\s\S]*?)```/;

const UNAVAILABLE_REPLY =
  "El entrenamiento por chat no está disponible en este momento. Probá de nuevo más tarde.";

const LIMIT_REACHED_REPLY =
  "Ya tenemos casi toda la información necesaria. Voy a cerrar la configuración con lo que tenemos y después podés completar o modificar cualquier dato desde el panel. Lo que haya quedado pendiente lo vas a ver marcado ahí para retomarlo cuando quieras.";

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

// Tolera el desvío más común de un LLM generando JSON "a mano": una coma
// colgante antes de cerrar un objeto o array. No es un parser JSON5 completo
// a propósito — cubre el caso real observado sin esconder errores
// estructurales de verdad (esos siguen fallando y disparando el flujo de
// corrección existente).
function parseJsonLenient(raw: string): { data: unknown; error: null } | { data: null; error: string } {
  try {
    return { data: JSON.parse(raw), error: null };
  } catch (firstError) {
    try {
      const cleaned = raw.replace(/,\s*([}\]])/g, "$1");
      return { data: JSON.parse(cleaned), error: null };
    } catch {
      return {
        data: null,
        error: firstError instanceof Error ? firstError.message : String(firstError),
      };
    }
  }
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

  const { data: parsedJson, error: jsonError } = parseJsonLenient(match[1].trim());
  if (jsonError) {
    const reason = `el bloque no es JSON válido (${jsonError})`;
    console.error("[training] Bloque proposal con JSON inválido:", jsonError, "\nRaw:", match[1]);
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

function normalizeForComparison(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Heurística barata (sin distancia de edición) para detectar que la IA le
// está haciendo al dueño básicamente la misma pregunta dos veces seguidas —
// el bug real reportado: el asistente repreguntaba algo que el dueño ya
// había contestado, sin que hubiera ninguna defensa en el backend más allá
// de "esperar que el prompt lo evite". Comparación por overlap de tokens:
// atrapa reformulaciones de la misma pregunta, no solo texto idéntico.
function isNearDuplicateReply(a: string, b: string): boolean {
  const na = normalizeForComparison(a);
  const nb = normalizeForComparison(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const tokensA = new Set(na.split(" "));
  const tokensB = new Set(nb.split(" "));
  const [smaller, larger] = tokensA.size <= tokensB.size ? [tokensA, tokensB] : [tokensB, tokensA];
  if (smaller.size < 3) return false; // frases muy cortas: overlap alto es normal, no es señal confiable

  const overlap = [...smaller].filter((t) => larger.has(t)).length;
  return overlap / smaller.size >= 0.85;
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
    return { reply: UNAVAILABLE_REPLY, proposal: null, limitReached: false };
  }

  // Único punto de activación de la "sección activa" (currentSection): idempotente,
  // no hace nada si ya hay una en progreso o si todavía no existe plan.
  // Garantiza, sin depender del modelo, que siempre haya un tema claro sobre
  // el que preguntar en este turno.
  await activateNextPendingSection(businessId);

  const conversation = await getOrCreateConversation(businessId, mode);
  const priorMessages = await getRawMessages(conversation.id);
  await appendMessage(conversation.id, "user", message);

  // Corte duro, independiente del prompt: cuenta respuestas de IA YA
  // persistidas en esta conversación contra un límite configurable (hoy por
  // env var, mañana por plan — ver lib/ai-limits.ts). El mensaje del dueño
  // recién escrito ya quedó guardado arriba pase lo que pase acá abajo: nunca
  // se pierde información aunque el corte se dispare en este mismo turno.
  const assistantResponseCount = priorMessages.filter((m) => m.role === "assistant").length;
  const limit = await getAiResponseLimit(businessId, mode);

  if (assistantResponseCount >= limit) {
    // No llamamos a Gemini ni una vez más: se cierra determinísticamente,
    // igual que el botón "Terminar configuración" (ver
    // ignoreRemainingSections), y se le explica al dueño con el mismo texto
    // que se le anticipó en el prompt cerca del límite.
    await ignoreRemainingSections(businessId);
    await appendMessage(conversation.id, "assistant", LIMIT_REACHED_REPLY);
    return { reply: LIMIT_REACHED_REPLY, proposal: null, limitReached: true };
  }

  const context = await buildBusinessContext(businessId);
  const responsesRemaining = limit - assistantResponseCount;
  const prompt = buildTrainingPrompt(context, mode, priorMessages.length, responsesRemaining);

  const meta: AiUsageMeta = {
    businessId,
    operation: mode === "onboarding" ? "training_onboarding" : "training_continuous",
  };

  const geminiHistory = priorMessages.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    text: m.content,
  }));

  const raw = await provider.generateResponse(message, geminiHistory, prompt, meta);
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
      prompt,
      meta
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
      prompt,
      meta
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
  } else if (!proposal) {
    // Sin propuesta y sin ninguno de los dos casos de arriba: es el momento
    // de chequear si la IA está repitiendo la pregunta anterior casi textual
    // (ver isNearDuplicateReply). Con proposal presente no hace falta este
    // chequeo — una propuesta implica que la sección se está cerrando, no
    // que se está re-preguntando algo.
    const previousAssistantMessage = [...priorMessages].reverse().find((m) => m.role === "assistant")?.content ?? null;

    if (previousAssistantMessage && isNearDuplicateReply(reply, previousAssistantMessage)) {
      console.warn("[training] Respuesta casi idéntica a la anterior — forzando corrección para evitar loop.", {
        businessId,
        previous: previousAssistantMessage,
        current: reply,
      });

      const correction =
        "(Mensaje del sistema: tu respuesta anterior fue prácticamente idéntica a la que le acabás de mandar de nuevo al dueño — probablemente ya te respondió esto antes. Revisá ESTADO ACTUAL y el historial: si ya tenés lo esencial del tema activo, cerralo AHORA con un bloque proposal en vez de repetir la pregunta. Si de verdad falta algo puntual, preguntá algo CONCRETO y distinto, nunca la misma pregunta reformulada.)";

      const retryRaw = await provider.generateResponse(
        correction,
        [...geminiHistory, { role: "user", text: message }, { role: "model", text: raw }],
        prompt,
        meta
      );
      const retry = parseTrainingTurn(retryRaw);

      // Si el reintento TAMBIÉN resulta casi idéntico, nos quedamos con la
      // respuesta original en vez de forzar un tercer intento — puede ser un
      // falso positivo (el tema realmente amerita reformular la pregunta) y
      // no vale la pena seguir gastando llamadas por eso.
      if (!isNearDuplicateReply(retry.reply, previousAssistantMessage)) {
        reply = retry.reply;
        proposal = retry.proposal;
      }
    }
  }

  await appendMessage(conversation.id, "assistant", reply);

  return { reply, proposal, limitReached: false };
}
