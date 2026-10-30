import type { Conversation, ConversationFlowState, MessageCategory } from "@/lib/types";
import { aiLogger } from "@/modules/ai/logger";
import { getAIProvider } from "@/modules/ai/providers";
import type { BusinessContext } from "@/modules/ai/providers/base";
import { applyRules } from "@/modules/ai/rule-engine";
import { computeNextState, triageMessage } from "@/modules/ai/triage/engine";
import type { AIResponse, MessageIntent } from "@/modules/ai/types";
import { handleBookingFlow } from "@/modules/ai/booking/flow";
import { decideRoute, looksLikeQuestion } from "@/modules/ai/intent/route";
import { questionFor } from "@/modules/ai/proposal/draft";
import { handleProposalFlow, startProposalFlow } from "@/modules/ai/proposal/flow";
import { isBookableService } from "@/modules/business/service";
import { buildPrompt } from "@/modules/ai/prompt/builder";
import { buildBusinessContext } from "@/modules/employee/context";
import { resolveStrategy } from "@/modules/employee/strategy/resolve";
import { conversationRepository } from "@/modules/whatsapp/conversations/repository";
import type { AssistantAction } from "@/modules/ai/actions";
import { handoffOutcome, leadMissingDataOutcome, leadRegisteredOutcome, runAssistantTurn, type ActionExecutor } from "@/modules/ai/assistant-turn";
import { captureLead, getOpenInquiryForConversation } from "@/modules/inquiries/capture";

const ESCALATION_RESPONSE =
  "No tengo esa información disponible. Te voy a derivar con alguien de nuestro equipo para ayudarte.";

// Sin plazos inventados: describe lo que realmente pasa (la conversación
// queda en modo manual para que la siga una persona).
const HANDOFF_RULE_RESPONSE = "¡Claro! Dejo la conversación para que una persona del equipo la continúe por este mismo chat.";

const CATEGORY_TO_INTENT: Record<MessageCategory, MessageIntent> = {
  APPOINTMENT: "appointment",
  PRICING: "pricing",
  SERVICE: "service",
  SCHEDULE: "schedule",
  HUMAN: "human",
  PROPOSAL: "proposal",
  IRRELEVANT: "other",
};

const INTENT_LABEL: Partial<Record<MessageIntent, AIResponse["labelHint"]>> = {
  pricing: "pricing",
  service: "service_inquiry",
};

// Ejecutor real de las acciones del asistente en WhatsApp: escribe en la
// base y devuelve el resultado REAL (ver modules/ai/assistant-turn.ts).
function whatsappExecutor(context: BusinessContext, conversation: Conversation, canRegister: boolean): ActionExecutor {
  const register = (data: AssistantAction["data"]) =>
    captureLead({
      businessId: context.business.id,
      channel: "whatsapp",
      conversationRef: conversation.id,
      name: data.nombre || conversation.contactName,
      phone: conversation.contactPhone,
      email: data.email,
      need: data.necesidad ?? "",
      summary: data.resumen,
    });

  return async (action) => {
    if (action.name === "register_lead") {
      const result = await register(action.data);
      if (result.ok) {
        aiLogger.log({ type: "action_executed", conversationId: conversation.id, action: "register_lead", ok: true });
        return leadRegisteredOutcome({ need: action.data.necesidad ?? "", created: result.created });
      }
      aiLogger.log({ type: "action_executed", conversationId: conversation.id, action: "register_lead", ok: false });
      if (result.reason === "invalid") return leadMissingDataOutcome(result.message.replace(/^Faltan datos: /, ""));
      // Error técnico: no se simula nada; se deriva a una persona.
      return handoffOutcome({ summary: action.data.resumen, registered: false, registerFailed: true });
    }

    // Derivación. Si el modelo ya sabe qué necesita, también queda registrado
    // (best-effort: la derivación ocurre igual si el registro falla).
    let registered = false;
    if (canRegister && action.data.necesidad) {
      const result = await register(action.data);
      registered = result.ok;
    }
    aiLogger.log({ type: "action_executed", conversationId: conversation.id, action: "handoff", ok: true });
    return handoffOutcome({ summary: action.data.resumen, registered });
  };
}

async function callLLM(
  conversationId: string,
  message: string,
  intent: MessageIntent,
  context: BusinessContext,
  conversation: Conversation,
  forcedAction?: AssistantAction,
): Promise<AIResponse> {
  const provider = getAIProvider("whatsapp_reply");
  if (!provider) {
    aiLogger.log({ type: "response_generated", conversationId, source: "escalation", escalate: true });
    return { text: ESCALATION_RESPONSE, intent, source: "escalation", escalateToHuman: true };
  }

  // El mensaje actual ya está guardado en la conversación cuando llega acá
  // (y el proveedor lo vuelve a agregar al final): se saca del historial
  // para que el modelo no lo reciba duplicado.
  const previous = conversation.messages.at(-1)?.sender === "customer" && conversation.messages.at(-1)?.text === message
    ? conversation.messages.slice(0, -1)
    : conversation.messages;
  const history = previous.slice(-10).map((m) => ({
    role: m.sender === "customer" ? ("user" as const) : ("model" as const),
    text: m.text,
  }));

  aiLogger.log({ type: "llm_usage", conversationId, model: provider.modelId });

  const strategy = resolveStrategy(context);
  const strategyContext = strategy.shapeContext(context, conversation);

  // "Consultas" (capacidad del empleado) habilita el registro de interesados.
  const canRegister = context.employee.capabilities.find((c) => c.key === "inquiries")?.enabled ?? true;
  const openInquiry = canRegister ? await getOpenInquiryForConversation(context.business.id, conversation.id) : null;

  const result = await runAssistantTurn({
    provider,
    context: strategyContext,
    conversation,
    message,
    history,
    options: {
      actions: { registerLead: canRegister, handoff: true },
      customer: { name: conversation.contactName, phone: conversation.contactPhone },
      openInquiry: openInquiry ? { need: openInquiry.need } : null,
    },
    meta: { businessId: context.business.id, operation: "whatsapp_reply" },
    execute: whatsappExecutor(context, conversation, canRegister),
    forcedAction,
  });

  aiLogger.log({ type: "response_generated", conversationId, source: "llm", escalate: result.escalate });
  return {
    text: result.text,
    intent: result.escalate ? "human" : intent,
    source: "llm",
    escalateToHuman: result.escalate,
    labelHint: result.escalate ? "human_required" : INTENT_LABEL[intent],
  };
}

// Respuesta "estándar" (consulta general): el modelo con los datos del
// negocio, o la regla fija como respaldo. No cambia el estado de ningún flujo.
async function standardResponse(
  conversationId: string,
  message: string,
  intent: MessageIntent,
  context: BusinessContext,
  conversation: Conversation,
): Promise<AIResponse> {
  aiLogger.log({ type: "intent_detected", conversationId, intent, preview: message.slice(0, 80) });
  const ruleResult = applyRules(message, intent, context);
  const llmResponse = getAIProvider("whatsapp_reply")
    ? await callLLM(conversationId, message, intent, context, conversation).catch((error) => {
        if (!ruleResult) throw error;
        console.error("[AI] El modelo falló, se responde con la regla:", error instanceof Error ? error.message : error);
        return null;
      })
    : null;
  if (llmResponse) return llmResponse;
  if (ruleResult) {
    aiLogger.log({ type: "rule_match", conversationId, intent, rule: ruleResult.rule });
    aiLogger.log({ type: "response_generated", conversationId, source: "rule", escalate: ruleResult.escalateToHuman ?? false });
    return {
      text: ruleResult.text,
      intent,
      source: "rule",
      escalateToHuman: ruleResult.escalateToHuman ?? false,
      labelHint: ruleResult.labelHint,
    };
  }
  return callLLM(conversationId, message, intent, context, conversation);
}

// Después de responder una pregunta suelta, se invita a retomar el flujo que
// estaba en curso (sin perder lo ya recopilado).
function flowReminder(conversation: Conversation): string {
  if (conversation.flowState === "COLLECTING_PROPOSAL" && conversation.proposalDraft) {
    return `\n\nRetomando tu solicitud de propuesta: ${questionFor(conversation.proposalDraft.pending, conversation.proposalDraft)}`;
  }
  if (conversation.flowState === "WAITING_PROPOSAL_CONFIRMATION") {
    return "\n\nCuando quieras, respondé *sí* para registrar tu solicitud de propuesta o decime qué querés corregir.";
  }
  if (conversation.flowState === "WAITING_SLOT_SELECTION") return "\n\nCuando quieras, seguimos con tu reserva: elegí uno de los horarios que te pasé 😊";
  if (conversation.flowState === "WAITING_CONFIRMATION") return "\n\nCuando quieras, seguimos con tu reserva: respondé *sí* para confirmar o *no* para cancelar.";
  return "";
}

export async function processMessage(params: {
  conversationId: string;
  businessId: string;
  message: string;
}): Promise<AIResponse | null> {
  const { conversationId, businessId, message } = params;

  const context = await buildBusinessContext(businessId, { query: message });

  const conversation = conversationRepository.get(businessId, conversationId);
  if (!conversation) return null;
  if (conversation.manualMode || conversation.flowState === "HUMAN_HANDOFF") return null;

  // ── TRIAGE ─────────────────────────────────────────────────────────────────
  const triage = triageMessage(message, conversation, { hasBookableServices: context.services.some(isBookableService) });
  const { classification, stateBefore } = triage;

  if (!triage.shouldRespond) {
    aiLogger.log({
      type: "triage",
      conversationId,
      category: classification.category,
      confidence: classification.confidence,
      stateBefore,
      stateAfter: stateBefore,
      action: "ignored",
      ignoreReason: classification.ignoreReason,
    });
    conversationRepository.setTriage(businessId, conversationId, {
      category: classification.category,
      confidence: classification.confidence,
      action: "ignored",
      ignoreReason: classification.ignoreReason,
      at: new Date().toISOString(),
    });
    return null;
  }

  const intent = CATEGORY_TO_INTENT[classification.category];

  // ── ROUTING ─────────────────────────────────────────────────────────────────
  // Qué flujo atiende el mensaje lo decide decideRoute() (modules/ai/intent):
  // una reserva solo arranca con un pedido de reserva, y desde cualquier flujo
  // se puede salir hacia otro sin perder datos ni ejecutar nada sin confirmar.
  const route = decideRoute({
    flowState: conversation.flowState,
    intent: classification.intent,
    isQuestion: looksLikeQuestion(message),
  });

  let aiResponse: AIResponse;

  switch (route) {
    // HUMAN escalation always wins (regardless of flow state).
    // Con IA disponible, el mensaje de cierre lo redacta el modelo (resume lo
    // que entendió y explica qué sigue); si no, la regla fija.
    case "human": {
      const ruleResult = applyRules(message, "human", context);
      const ruleResponse: AIResponse = ruleResult
        ? { text: ruleResult.text, intent: "human", source: "rule", escalateToHuman: true, labelHint: ruleResult.labelHint }
        : { text: HANDOFF_RULE_RESPONSE, intent: "human", source: "rule", escalateToHuman: true, labelHint: "human_required" };
      aiResponse = ruleResult?.rule === "faq_match" || !getAIProvider("whatsapp_reply")
        ? ruleResponse
        : await callLLM(conversationId, message, "human", context, conversation, { name: "handoff", data: {} }).catch((error) => {
            console.error("[AI] Error redactando la derivación, se usa la regla:", error instanceof Error ? error.message : error);
            return ruleResponse;
          });
      break;
    }

    // Solicitud de propuesta. Desde una reserva en curso se conserva el
    // servicio que el cliente había elegido (no se vuelve a preguntar) y la
    // reserva NO se ejecuta: queda sin confirmar.
    case "proposal_switch":
      aiResponse = startProposalFlow(message, conversation, { service: conversation.bookingSession?.service ?? null });
      break;
    case "proposal_start":
      aiResponse = startProposalFlow(message, conversation);
      break;
    case "proposal_continue":
      aiResponse = await handleProposalFlow(message, conversation);
      break;

    // De una propuesta a una reserva explícita: la reserva arranca de cero
    // (el borrador de la propuesta queda guardado por si el cliente vuelve).
    case "booking_switch":
      conversationRepository.setFlowState(businessId, conversationId, "IDLE");
      aiResponse = await handleBookingFlow(message, { ...conversation, flowState: "IDLE" }, context);
      break;
    case "booking_start":
    case "booking_continue":
      aiResponse = await handleBookingFlow(message, conversation, context);
      break;

    // Reserva activa: una consulta de negocio la interrumpe sin romperla.
    case "booking_interruptible": {
      const ruleResult = ["PRICING", "SERVICE", "SCHEDULE"].includes(classification.category) ? applyRules(message, intent, context) : null;
      if (ruleResult && !ruleResult.escalateToHuman) {
        aiResponse = { text: ruleResult.text, intent, source: ruleResult.rule as AIResponse["source"], escalateToHuman: false, labelHint: ruleResult.labelHint };
      } else {
        aiResponse = await handleBookingFlow(message, conversation, context);
      }
      break;
    }

    // Pregunta en medio de una reserva o una propuesta: se responde y el flujo
    // queda exactamente donde estaba.
    case "answer_keep": {
      const answer = await standardResponse(conversationId, message, intent, context, conversation);
      aiResponse = { ...answer, text: `${answer.text}${flowReminder(conversation)}`, escalateToHuman: answer.escalateToHuman };
      break;
    }

    // Standard. Con IA disponible responde el modelo (con los servicios,
    // precios y FAQ en el prompt): las reglas fijas daban respuestas planas
    // que cortaban la conversación. Las reglas quedan como respaldo sin IA o
    // si el modelo falla. Consultar o nombrar un servicio NO inicia una reserva.
    default:
      aiResponse = await standardResponse(conversationId, message, intent, context, conversation);
  }

  // ── STATE TRANSITION + AUDIT ────────────────────────────────────────────────
  // Re-read conversation so we pick up any state changes made by handleBookingFlow
  const updatedConversation = conversationRepository.get(businessId, conversationId);
  const stateAfter: ConversationFlowState =
    updatedConversation?.flowState ??
    computeNextState(stateBefore, classification.category, aiResponse.text);

  // Only run computeNextState if booking flow didn't already update the state
  if (route === "standard") {
    const computed = computeNextState(stateBefore, classification.category, aiResponse.text);
    if (computed !== stateAfter) {
      conversationRepository.setFlowState(businessId, conversationId, computed);
    }
  }

  const action = aiResponse.escalateToHuman ? "escalated" : "responded";
  aiLogger.log({
    type: "triage",
    conversationId,
    category: classification.category,
    confidence: classification.confidence,
    stateBefore,
    stateAfter,
    action,
  });
  conversationRepository.setTriage(businessId, conversationId, {
    category: classification.category,
    confidence: classification.confidence,
    action,
    at: new Date().toISOString(),
  });

  return aiResponse;
}
