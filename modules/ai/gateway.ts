import type { Conversation, ConversationFlowState, MessageCategory } from "@/lib/types";
import { aiLogger } from "@/modules/ai/logger";
import { getAIProvider } from "@/modules/ai/providers";
import type { BusinessContext } from "@/modules/ai/providers/base";
import { applyRules } from "@/modules/ai/rule-engine";
import { computeNextState, triageMessage } from "@/modules/ai/triage/engine";
import type { AIResponse, MessageIntent } from "@/modules/ai/types";
import { handleBookingFlow } from "@/modules/ai/booking/flow";
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

// These states require the booking flow to handle responses (user is mid-selection/confirmation)
const STICKY_BOOKING_STATES = new Set<ConversationFlowState>([
  "WAITING_SLOT_SELECTION",
  "WAITING_CONFIRMATION",
  "WAITING_PAYMENT_PROOF",
]);

// In these states the booking flow is active but can be interrupted by explicit business questions
const ACTIVE_BOOKING_STATES = new Set<ConversationFlowState>([
  "COLLECTING_INTENT",
  "OFFERING_SLOTS",
]);

const CATEGORY_TO_INTENT: Record<MessageCategory, MessageIntent> = {
  APPOINTMENT: "appointment",
  PRICING: "pricing",
  SERVICE: "service",
  SCHEDULE: "schedule",
  HUMAN: "human",
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
  const triage = triageMessage(message, conversation);
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

  let aiResponse: AIResponse;
  const inStickyBooking = STICKY_BOOKING_STATES.has(conversation.flowState);
  const inActiveBooking = ACTIVE_BOOKING_STATES.has(conversation.flowState);

  // 1. HUMAN escalation always wins (regardless of booking flow state).
  // Con IA disponible, el mensaje de cierre lo redacta el modelo (resume lo
  // que entendió y explica qué sigue); si no, la regla fija.
  if (classification.category === "HUMAN") {
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
  }
  // 2. Sticky booking states: slot selection and confirmation must go to booking flow
  else if (inStickyBooking) {
    aiResponse = await handleBookingFlow(message, conversation, context);
  }
  // 3. In active booking flow: interruptible by explicit business questions
  else if (inActiveBooking && ["PRICING", "SERVICE", "SCHEDULE"].includes(classification.category)) {
    const ruleResult = applyRules(message, intent, context);
    if (ruleResult && !ruleResult.escalateToHuman) {
      aiResponse = { text: ruleResult.text, intent, source: ruleResult.rule as AIResponse["source"], escalateToHuman: false, labelHint: ruleResult.labelHint };
    } else {
      // No rule matched during booking — continue booking flow
      aiResponse = await handleBookingFlow(message, conversation, context);
    }
  }
  // 4. Appointment intent or active booking flow → booking handler
  else if (classification.category === "APPOINTMENT" || inActiveBooking) {
    aiResponse = await handleBookingFlow(message, conversation, context);
  }
  // 5. Standard. Con IA disponible responde el modelo (con los servicios,
  // precios y FAQ en el prompt): las reglas fijas daban respuestas planas
  // que cortaban la conversación ("Estos son nuestros servicios y precios:
  // …"). Las reglas quedan como respaldo sin IA o si el modelo falla.
  else {
    aiLogger.log({ type: "intent_detected", conversationId, intent, preview: message.slice(0, 80) });
    const ruleResult = applyRules(message, intent, context);
    const llmResponse = getAIProvider("whatsapp_reply")
      ? await callLLM(conversationId, message, intent, context, conversation).catch((error) => {
          if (!ruleResult) throw error;
          console.error("[AI] El modelo falló, se responde con la regla:", error instanceof Error ? error.message : error);
          return null;
        })
      : null;
    if (llmResponse) {
      aiResponse = llmResponse;
    } else if (ruleResult) {
      aiLogger.log({ type: "rule_match", conversationId, intent, rule: ruleResult.rule });
      aiLogger.log({
        type: "response_generated",
        conversationId,
        source: "rule",
        escalate: ruleResult.escalateToHuman ?? false,
      });
      aiResponse = {
        text: ruleResult.text,
        intent,
        source: "rule",
        escalateToHuman: ruleResult.escalateToHuman ?? false,
        labelHint: ruleResult.labelHint,
      };
    } else {
      aiResponse = await callLLM(conversationId, message, intent, context, conversation);
    }
  }

  // ── STATE TRANSITION + AUDIT ────────────────────────────────────────────────
  // Re-read conversation so we pick up any state changes made by handleBookingFlow
  const updatedConversation = conversationRepository.get(businessId, conversationId);
  const stateAfter: ConversationFlowState =
    updatedConversation?.flowState ??
    computeNextState(stateBefore, classification.category, aiResponse.text);

  // Only run computeNextState if booking flow didn't already update the state
  if (!inStickyBooking && !inActiveBooking && classification.category !== "APPOINTMENT") {
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
