import type { TrainingMode } from "@/modules/ai/prompt/training";
import { resolveAiResponseLimit } from "@/modules/billing/subscription";

// Seam para límites de IA por plan — ya conectado a Postgres (ver
// modules/billing/subscription.ts): Subscription → Plan → aiCredits. Este
// archivo queda como el import estable que ya usan
// modules/employee/training/engine.ts, modules/ai/prompt/training.ts y
// lib/superadmin/queries.ts, sin que ninguno tenga que saber que el número
// ahora sale de la base en vez de una env var. La lógica de qué estado de
// Subscription permite qué límite (trialing vencido, canceled, etc.) vive
// toda en modules/billing/subscription.ts — acá no se reimplementa nada de
// eso.

// A partir de qué tanto falta para el límite el prompt empieza a presionar
// fuerte para cerrar (ver closingUrgency en modules/ai/prompt/training.ts).
export const CLOSING_WARNING_THRESHOLD = 3;

// Cantidad máxima de respuestas de IA (no de caracteres, no de tokens) que
// una conversación de entrenamiento puede consumir. Se cuenta sobre
// TrainingMessage con role "assistant" ya persistidos (ver
// modules/employee/training/engine.ts) — nunca sobre un contador en memoria,
// para que el límite sea el mismo sin importar de qué instancia del server
// venga el request.
export async function getAiResponseLimit(businessId: string, mode: TrainingMode): Promise<number> {
  return resolveAiResponseLimit(businessId, mode);
}

// Protección de abuso simple (sección 17 del pedido original): un mensaje
// desproporcionadamente largo no aporta a un onboarding conversacional y
// infla el costo del turno. No es un límite de tokens exacto, es un tope de
// caracteres barato de validar antes de siquiera tocar Gemini.
export const MAX_MESSAGE_LENGTH = 4000;
