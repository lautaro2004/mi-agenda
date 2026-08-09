import { GeminiProvider } from "@/modules/ai/providers/gemini";
import { buildPrompt } from "@/modules/ai/prompt/builder";
import { buildBusinessContext } from "@/modules/employee/context";
import { resolveStrategy } from "@/modules/employee/strategy/resolve";

// Reproduce exactamente el mismo pipeline que usa WhatsApp para generar
// respuestas con Gemini (ver callGemini en modules/ai/gateway.ts):
// buildBusinessContext -> Strategy -> buildPrompt -> GeminiProvider.
// No pasa por triage/rule-engine/booking-flow a propósito: esos módulos
// tienen efectos reales (crean turnos), y el simulador no debe modificar
// información del negocio automáticamente.
const ESCALATION_RESPONSE =
  "No tengo esa información disponible. Te voy a derivar con alguien de nuestro equipo para ayudarte.";

export interface SimulatorMessage {
  role: "customer" | "ai";
  text: string;
}

function geminiProvider(): GeminiProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GeminiProvider(apiKey);
}

export async function runSimulatorTurn(params: {
  businessId: string;
  history: SimulatorMessage[];
  message: string;
}): Promise<{ reply: string }> {
  const { businessId, history, message } = params;

  const provider = geminiProvider();
  if (!provider) {
    return { reply: ESCALATION_RESPONSE };
  }

  const context = await buildBusinessContext(businessId);
  const strategy = resolveStrategy(context);
  const strategyContext = strategy.shapeContext(context, null);
  const prompt = buildPrompt(strategyContext, null, message);

  const geminiHistory = history.slice(-10).map((m) => ({
    role: m.role === "customer" ? ("user" as const) : ("model" as const),
    text: m.text,
  }));

  const reply = await provider.generateResponse(message, geminiHistory, prompt);
  return { reply };
}
