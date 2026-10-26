import type { AIProvider } from "@/modules/ai/providers/base";
import { AnthropicProvider } from "@/modules/ai/providers/anthropic";
import { GeminiProvider } from "@/modules/ai/providers/gemini";
import type { AiOperation } from "@/modules/ai/usage";

// Único punto donde se decide QUÉ modelo responde. Antes cada módulo
// (gateway de WhatsApp, entrenamiento, simulador, SEO) instanciaba Gemini
// por su cuenta.
//
// - Claude (ANTHROPIC_API_KEY) es el proveedor principal.
// - Gemini (GEMINI_API_KEY) queda como respaldo: si no hay clave de Claude,
//   todo sigue funcionando como antes. AI_PROVIDER=gemini fuerza Gemini.
// - Modelo por tipo de tarea: las respuestas a clientes y el simulador usan
//   el modelo rápido/económico; el entrenamiento (onboarding asistido) y el
//   SEO usan uno más capaz, porque generan JSON estructurado (plan de
//   entrenamiento, servicios, FAQ) y su volumen es bajo.

export const DEFAULT_CLAUDE_FAST_MODEL = "claude-haiku-5-5";
export const DEFAULT_CLAUDE_SMART_MODEL = "claude-sonnet-5-5";

const SMART_OPERATIONS: AiOperation[] = ["training_onboarding", "training_continuous", "seo_generate", "landing_copy"];

const MAX_TOKENS: Record<AiOperation, number> = {
  whatsapp_reply: 1024,
  simulator: 1024,
  training_onboarding: 4096,
  training_continuous: 4096,
  seo_generate: 2048,
  // Calificación de leads: devuelve un JSON chico ({decision, reason}).
  lead_qualification: 512,
  // Textos de la plantilla de captación: JSON mediano (hero, pasos, cierre).
  landing_copy: 2048,
};

export type AIProviderName = "claude" | "gemini";

export function activeProviderName(): AIProviderName | null {
  const forced = process.env.AI_PROVIDER?.toLowerCase();
  if (forced === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}

export function getAIProvider(operation: AiOperation): AIProvider | null {
  const name = activeProviderName();
  if (name === "claude") {
    const smart = SMART_OPERATIONS.includes(operation);
    const model = smart
      ? process.env.ANTHROPIC_MODEL_SMART || DEFAULT_CLAUDE_SMART_MODEL
      : process.env.ANTHROPIC_MODEL || DEFAULT_CLAUDE_FAST_MODEL;
    return new AnthropicProvider(process.env.ANTHROPIC_API_KEY!, model, MAX_TOKENS[operation]);
  }
  if (name === "gemini") return new GeminiProvider(process.env.GEMINI_API_KEY!);
  return null;
}
