import type { TrainingMode } from "@/modules/ai/prompt/training";

// Seam para límites de IA por plan. Hoy no existe todavía un modelo
// Subscription/Plan persistido (Subscription en lib/types.ts es un mock de
// un único plan, nunca guardado en Postgres) — hasta que exista, el límite
// sale de configuración por entorno, con estos defaults. El día que haya un
// Plan real, getAiResponseLimit() es el ÚNICO lugar que hay que tocar: pasa
// a leer plan.aiCredits / plan.aiTokenLimit según el negocio en vez de estas
// constantes. Todo el resto del sistema (motor de entrenamiento, UI) ya
// consume el número a través de esta función, nunca la env var directo.
const DEFAULT_ONBOARDING_MAX_AI_RESPONSES = 40;
const DEFAULT_CONTINUOUS_MAX_AI_RESPONSES = 200;

// A partir de qué tanto falta para el límite el prompt empieza a presionar
// fuerte para cerrar (ver closingUrgency en modules/ai/prompt/training.ts).
export const CLOSING_WARNING_THRESHOLD = 3;

function readPositiveInt(envValue: string | undefined, fallback: number): number {
  const parsed = envValue ? Number(envValue) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

// Cantidad máxima de respuestas de IA (no de caracteres, no de tokens) que
// una conversación de entrenamiento puede consumir. Se cuenta sobre
// TrainingMessage con role "assistant" ya persistidos (ver
// modules/employee/training/engine.ts) — nunca sobre un contador en memoria,
// para que el límite sea el mismo sin importar de qué instancia del server
// venga el request.
export async function getAiResponseLimit(_businessId: string, mode: TrainingMode): Promise<number> {
  if (mode === "onboarding") {
    return readPositiveInt(process.env.ONBOARDING_MAX_AI_RESPONSES, DEFAULT_ONBOARDING_MAX_AI_RESPONSES);
  }
  return readPositiveInt(process.env.CONTINUOUS_MAX_AI_RESPONSES, DEFAULT_CONTINUOUS_MAX_AI_RESPONSES);
}

// Protección de abuso simple (sección 17 del pedido original): un mensaje
// desproporcionadamente largo no aporta a un onboarding conversacional y
// infla el costo del turno. No es un límite de tokens exacto, es un tope de
// caracteres barato de validar antes de siquiera tocar Gemini.
export const MAX_MESSAGE_LENGTH = 4000;
