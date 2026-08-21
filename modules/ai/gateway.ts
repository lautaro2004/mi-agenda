import type { Conversation, ConversationFlowState, MessageCategory } from "@/lib/types";
import { aiLogger } from "@/modules/ai/logger";
import { GeminiProvider } from "@/modules/ai/providers/gemini";
import type { BusinessContext } from "@/modules/ai/providers/base";
import { applyRules } from "@/modules/ai/rule-engine";
import { computeNextState, triageMessage } from "@/modules/ai/triage/engine";
import type { AIResponse, MessageIntent } from "@/modules/ai/types";
import { handleBookingFlow } from "@/modules/ai/booking/flow";
import { buildPrompt } from "@/modules/ai/prompt/builder";
import { buildBusinessContext } from "@/modules/employee/context";
import { resolveStrategy } from "@/modules/employee/strategy/resolve";
import { conversationRepository } from "@/modules/whatsapp/conversations/repository";

const ESCALATION_RESPONSE =
  "No tengo esa información disponible. Te voy a derivar con alguien de nuestro equipo para ayudarte.";

// These states require the booking flow to handle responses (user is mid-selection/confirmation)
const STICKY_BOOKING_STATES = new Set<ConversationFlowState>([
  "WAITING_SLOT_SELECTION",
  "WAITING_CONFIRMATION",
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

function geminiProvider(): GeminiProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GeminiProvider(apiKey);
}

async function callGemini(
  conversationId: string,
  message: string,
  intent: MessageIntent,
  context: BusinessContext,
  conversation: Conversation,
): Promise<AIResponse> {
  const provider = geminiProvider();
  if (!provider) {
    aiLogger.log({ type: "response_generated", conversationId, source: "escalation", escalate: true });
    return { text: ESCALATION_RESPONSE, intent, source: "escalation", escalateToHuman: true };
  }

  const history = conversation.messages.slice(-10).map((m) => ({
    role: m.sender === "customer" ? ("user" as const) : ("model" as const),
    text: m.text,
  }));

  aiLogger.log({ type: "gemini_usage", conversationId, model: provider.modelId });

  const strategy = resolveStrategy(context);
  const strategyContext = strategy.shapeContext(context, conversation);
  const prompt = buildPrompt(strategyContext, conversation, message);

  const text = await provider.generateResponse(message, history, prompt, {
    businessId: context.business.id,
    operation: "whatsapp_reply",
  });
  const escalateToHuman = text.includes("derivar con") || text.includes("nuestro equipo");

  aiLogger.log({ type: "response_generated", conversationId, source: "gemini", escalate: escalateToHuman });
  return { text, intent, source: "gemini", escalateToHuman };
}

export async function processMessage(params: {
  conversationId: string;
  businessId: string;
  message: string;
}): Promise<AIResponse | null> {
  const { conversationId, businessId, message } = params;

  const context = await buildBusinessContext(businessId, { query: message });

  const conversation = conversationRepository.get(conversationId);
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
    conversationRepository.setTriage(conversationId, {
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

  // 1. HUMAN escalation always wins (regardless of booking flow state)
  if (classification.category === "HUMAN") {
    const ruleResult = applyRules(message, "human", context);
    aiResponse = ruleResult
      ? { text: ruleResult.text, intent: "human", source: "rule", escalateToHuman: true, labelHint: ruleResult.labelHint }
      : { text: "¡Claro! Te comunico con alguien de nuestro equipo enseguida.", intent: "human", source: "rule", escalateToHuman: true, labelHint: "human_required" };
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
  // 5. Standard: FAQ → rule engine → Gemini
  else {
    aiLogger.log({ type: "intent_detected", conversationId, intent, preview: message.slice(0, 80) });
    const ruleResult = applyRules(message, intent, context);
    if (ruleResult) {
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
      aiResponse = await callGemini(conversationId, message, intent, context, conversation);
    }
  }

  // ── STATE TRANSITION + AUDIT ────────────────────────────────────────────────
  // Re-read conversation so we pick up any state changes made by handleBookingFlow
  const updatedConversation = conversationRepository.get(conversationId);
  const stateAfter: ConversationFlowState =
    updatedConversation?.flowState ??
    computeNextState(stateBefore, classification.category, aiResponse.text);

  // Only run computeNextState if booking flow didn't already update the state
  if (!inStickyBooking && !inActiveBooking && classification.category !== "APPOINTMENT") {
    const computed = computeNextState(stateBefore, classification.category, aiResponse.text);
    if (computed !== stateAfter) {
      conversationRepository.setFlowState(conversationId, computed);
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
  conversationRepository.setTriage(conversationId, {
    category: classification.category,
    confidence: classification.confidence,
    action,
    at: new Date().toISOString(),
  });

  return aiResponse;
}
