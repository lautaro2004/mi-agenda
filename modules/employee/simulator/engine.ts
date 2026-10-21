import { getAIProvider } from "@/modules/ai/providers";
import { handoffOutcome, leadMissingDataOutcome, leadRegisteredOutcome, runAssistantTurn, type ActionExecutor } from "@/modules/ai/assistant-turn";
import { buildBusinessContext } from "@/modules/employee/context";
import { resolveStrategy } from "@/modules/employee/strategy/resolve";
import { normalizeCaptureInput } from "@/modules/inquiries/capture";

// Reproduce el mismo turno del asistente que WhatsApp (prompt, acciones y
// mensaje final: ver modules/ai/assistant-turn.ts), pero con un ejecutor que
// NO escribe nada: registrar un interesado o derivar solo se informan en la
// respuesta (`action`), para que el dueño vea qué pasaría en una
// conversación real. No pasa por triage/rule-engine/booking-flow a
// propósito: esos módulos tienen efectos reales (crean turnos).
const ESCALATION_RESPONSE =
  "No tengo esa información disponible. Te voy a derivar con alguien de nuestro equipo para ayudarte.";

export interface SimulatorMessage {
  role: "customer" | "ai";
  text: string;
}

export interface SimulatorAction {
  action: "register_lead" | "handoff";
  ok: boolean;
  detail?: string;
}

const simulatedExecutor: ActionExecutor = async (action) => {
  if (action.name === "register_lead") {
    // Mismas validaciones que el registro real (sin escribir).
    const check = normalizeCaptureInput({
      businessId: "simulador",
      channel: "whatsapp",
      conversationRef: "simulador",
      name: action.data.nombre ?? "",
      phone: "+5491100000000",
      email: action.data.email,
      need: action.data.necesidad ?? "",
      summary: action.data.resumen,
    });
    if (check.errors.length) return leadMissingDataOutcome(check.errors.join(", "), true);
    const outcome = leadRegisteredOutcome({ need: check.need, created: true, simulated: true });
    return { ...outcome, info: { ...outcome.info, detail: `${check.name} — ${check.need}` } };
  }
  return handoffOutcome({ summary: action.data.resumen, registered: false, simulated: true });
};

export async function runSimulatorTurn(params: {
  businessId: string;
  history: SimulatorMessage[];
  message: string;
}): Promise<{ reply: string; action?: SimulatorAction }> {
  const { businessId, history, message } = params;

  const provider = getAIProvider("simulator");
  if (!provider) {
    return { reply: ESCALATION_RESPONSE };
  }

  const context = await buildBusinessContext(businessId);
  const strategy = resolveStrategy(context);
  const strategyContext = strategy.shapeContext(context, null);
  const canRegister = context.employee.capabilities.find((c) => c.key === "inquiries")?.enabled ?? true;

  const chatHistory = history.slice(-10).map((m) => ({
    role: m.role === "customer" ? ("user" as const) : ("model" as const),
    text: m.text,
  }));

  const result = await runAssistantTurn({
    provider,
    context: strategyContext,
    conversation: null,
    message,
    history: chatHistory,
    // Como en WhatsApp, el teléfono ya se conoce por el chat.
    options: { actions: { registerLead: canRegister, handoff: true }, customer: { phone: "simulado" } },
    meta: { businessId, operation: "simulator" },
    execute: simulatedExecutor,
  });

  return {
    reply: result.text,
    ...(result.action ? { action: { action: result.action.action, ok: result.action.ok, detail: result.action.detail } } : {}),
  };
}
