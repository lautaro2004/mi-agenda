import type { Conversation } from "@/lib/types";
import { parseAssistantAction, stripActionMarkers, type AssistantAction } from "@/modules/ai/actions";
import { buildPrompt, type PromptOptions } from "@/modules/ai/prompt/builder";
import type { AIProvider } from "@/modules/ai/providers/base";
import type { AiUsageMeta } from "@/modules/ai/usage";
import type { StrategyContext } from "@/modules/employee/strategy/types";

// Un turno del asistente con acciones reales (registrar interesado, derivar).
// Lo usan WhatsApp (gateway) y el simulador, cada uno con su ejecutor: el de
// WhatsApp escribe en la base; el del simulador no toca nada.
//
//   1. El modelo responde. Si no pide ninguna acción, esa es la respuesta.
//   2. Si pide una, el ejecutor la hace de verdad y devuelve el resultado.
//   3. El modelo escribe el mensaje final con ese resultado real. Si esa
//      segunda llamada falla, se usa un texto fijo coherente con el resultado.

export interface ActionOutcome {
  /** Resultado real, en lenguaje natural, para el modelo. */
  resultText: string;
  /** Mensaje fijo por si la segunda llamada al modelo falla. */
  fallbackText: string;
  /** ¿La conversación pasa a una persona? */
  escalate: boolean;
  /** Para la UI / logs (sin datos sensibles). */
  info: { action: AssistantAction["name"]; ok: boolean; detail?: string; simulated?: boolean };
}

export type ActionExecutor = (action: AssistantAction) => Promise<ActionOutcome>;

export interface AssistantTurnResult {
  text: string;
  escalate: boolean;
  action?: ActionOutcome["info"];
}

// Frase fija que el modelo usaba (y sigue usando sin acciones) para derivar.
const LEGACY_HANDOFF_PHRASE = "te voy a derivar";

export async function runAssistantTurn(params: {
  provider: AIProvider;
  context: StrategyContext;
  conversation: Conversation | null;
  message: string;
  history: Array<{ role: "user" | "model"; text: string }>;
  options: PromptOptions;
  meta: AiUsageMeta;
  execute: ActionExecutor;
  /** Acción ya decidida por el sistema (ej. el cliente pidió una persona). */
  forcedAction?: AssistantAction;
}): Promise<AssistantTurnResult> {
  const { provider, context, conversation, message, history, options, meta, execute } = params;

  let action = params.forcedAction ?? null;
  if (!action) {
    const prompt = buildPrompt(context, conversation, message, options);
    const first = await provider.generateResponse(message, history, prompt, meta);
    action = parseAssistantAction(first);
    const allowed =
      action &&
      ((action.name === "register_lead" && options.actions?.registerLead) || (action.name === "handoff" && options.actions?.handoff));
    if (!action || !allowed) {
      const text = stripActionMarkers(first);
      return { text, escalate: text.toLowerCase().includes(LEGACY_HANDOFF_PHRASE) };
    }
  }

  const outcome = await execute(action);

  let text = "";
  try {
    const finalPrompt = buildPrompt(context, conversation, message, {
      customer: options.customer,
      openInquiry: options.openInquiry,
      actionResult: outcome.resultText,
    });
    text = stripActionMarkers(await provider.generateResponse(message, history, finalPrompt, meta));
  } catch (error) {
    console.error("[ai/assistant] No se pudo redactar el mensaje final:", error instanceof Error ? error.message : error);
  }
  return { text: text || outcome.fallbackText, escalate: outcome.escalate, action: outcome.info };
}

// ── Textos de resultado compartidos ──────────────────────────────────────

const NO_PROMISES =
  "No prometas que lo van a contactar ni en qué plazo, salvo que figure en la información del negocio. No digas que avisaste o notificaste a nadie.";

export function leadRegisteredOutcome(input: { need: string; created: boolean; simulated?: boolean }): ActionOutcome {
  return {
    resultText: `El interesado quedó registrado correctamente${input.created ? "" : " (se actualizó el registro que ya existía)"}. Necesidad: ${input.need}.
Confirmale al cliente, con tus palabras, que sus datos y su consulta quedaron registrados para que el equipo del negocio los tenga. ${NO_PROMISES} Si tiene sentido, seguí la conversación (por ejemplo, ofrecé avanzar con una reserva o resolver otra duda).`,
    fallbackText: "Listo, dejé registrados tus datos y tu consulta para que el equipo del negocio los tenga. ¿Te puedo ayudar con algo más?",
    escalate: false,
    info: { action: "register_lead", ok: true, detail: input.need, simulated: input.simulated },
  };
}

export function leadMissingDataOutcome(missing: string, simulated?: boolean): ActionOutcome {
  return {
    resultText: `No se registró porque faltan datos: ${missing}. Pedile ese dato al cliente de forma natural, de a uno. No digas que quedó registrado.`,
    fallbackText: missing.includes("nombre") ? "¿Me decís tu nombre así dejo registrada tu consulta?" : "¿Me contás un poco más qué estás buscando?",
    escalate: false,
    info: { action: "register_lead", ok: false, detail: `Faltan datos: ${missing}`, simulated },
  };
}

export function handoffOutcome(input: { summary?: string; registered: boolean; registerFailed?: boolean; simulated?: boolean }): ActionOutcome {
  const intro = input.registerFailed ? "No se pudieron registrar los datos del cliente por un error técnico. En su lugar, l" : "L";
  return {
    resultText: `${intro}a conversación quedó derivada: una persona del equipo la va a continuar por este mismo chat${
      input.registered ? ", y su consulta quedó registrada con el resumen" : ""
    }.${input.summary ? ` Lo que entendiste: ${input.summary}` : ""}
Escribí el mensaje final: ${input.registerFailed ? "decile que no pudiste dejar registrados sus datos en este momento, " : ""}resumí en una o dos oraciones lo que entendiste de su consulta (si todavía no planteó ninguna, omitilo), contale que una persona del equipo va a seguir la conversación por este chat y despedite cordialmente. ${NO_PROMISES} No hagas preguntas.`,
    fallbackText: `${input.summary ? `Entiendo: ${input.summary} ` : ""}Dejo la conversación para que una persona del equipo la continúe por este mismo chat. ¡Gracias por escribirnos!`,
    escalate: true,
    info: { action: "handoff", ok: true, detail: input.summary, simulated: input.simulated },
  };
}
