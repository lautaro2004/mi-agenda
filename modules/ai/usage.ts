import { prisma } from "@/lib/prisma";

// Tipos de operación reconocidos — mantenido cerca de AiUsageEvent.operation
// (String libre en schema.prisma para no acoplar una migración a cada tipo
// nuevo, pero el código sí se tipa contra esta lista).
export type AiOperation =
  | "training_onboarding"
  | "training_continuous"
  | "whatsapp_reply"
  | "simulator"
  | "seo_generate";

// Usado por los filtros del dashboard de superadmin (ver lib/superadmin/queries.ts)
// para no repetir esta lista de literales en otro lado.
export const AI_OPERATIONS: AiOperation[] = [
  "training_onboarding",
  "training_continuous",
  "whatsapp_reply",
  "simulator",
  "seo_generate",
];

export interface AiUsageMeta {
  businessId: string;
  operation: AiOperation;
}

export interface AiUsageTokens {
  promptTokens: number | null;
  completionTokens: number | null;
}

// Fire-and-forget a propósito: registrar costo nunca puede ser la razón por
// la que una respuesta de IA falle. Si Postgres está caído en ese instante,
// se pierde ese único evento de métricas — preferible a bloquear el chat.
export function recordAiUsage(
  meta: AiUsageMeta,
  model: string,
  tokens: AiUsageTokens,
  success: boolean,
  errorMessage?: string
): void {
  prisma.aiUsageEvent
    .create({
      data: {
        businessId: meta.businessId,
        operation: meta.operation,
        model,
        promptTokens: tokens.promptTokens,
        completionTokens: tokens.completionTokens,
        success,
        errorMessage: errorMessage?.slice(0, 500),
      },
    })
    .catch((error) => {
      console.error("[ai/usage] No se pudo registrar el evento de uso:", error);
    });
}
