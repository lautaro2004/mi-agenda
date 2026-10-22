import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { ConversationMessage, LeadQualificationSettings } from "@/lib/types";
import { GeminiProvider } from "@/modules/ai/providers/gemini";
import type { BuiltPrompt } from "@/modules/ai/prompt/builder";
import { WHATSAPP_LEAD_WINDOW_DAYS } from "@/modules/inquiries/whatsapp-lead-constants";

// ── Calificación comercial de leads de WhatsApp (etapa 2) ──────────────────
// Flujo: con la calificación activa, cada consulta de WhatsApp nace
// "pending" (ver captureWhatsappLead). Cada mensaje del cliente reprograma
// un análisis para cuando la charla queda QUIETA_MS sin mensajes nuevos
// (debounce: un audio + tres mensajes seguidos = un solo análisis, no
// cuatro). La IA lee el chat (incluidas las respuestas del dueño en modo
// manual) contra la descripción del lead ideal y PROPONE: qualified,
// discarded o unclear. La aplicación valida y escribe — la IA nunca toca la
// base (docs/architecture/ai.md).
//
// Nodo sincroniza solo consultas sin calificar o "qualified": una "pending"
// espera, una "discarded" queda solo en Consultas de Nexo (por si la IA se
// equivocó, el dueño la puede marcar como calificada a mano).

export const QUIET_MS = 30_000;
// Tope de análisis por consulta: un chat largo que nunca se define deja de
// consumir IA. Queda "pending" y el dueño decide a mano.
export const MAX_ATTEMPTS_PER_INQUIRY = 6;
// Últimos mensajes que ve la IA — suficiente para calificar, acota tokens.
export const TRANSCRIPT_MAX_MESSAGES = 30;

export type QualificationDecision = "qualified" | "discarded" | "unclear";

const responseSchema = z.object({
  decision: z.enum(["qualified", "discarded", "unclear"]),
  reason: z.string().trim().min(1).max(300),
});

const JSON_FENCE = /```(?:json)?\s*([\s\S]*?)```/;

// ── Configuración por negocio ──────────────────────────────────────────────

export async function getLeadQualificationSettings(businessId: string): Promise<LeadQualificationSettings> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { leadQualificationEnabled: true, leadIdealProfile: true },
  });
  return {
    enabled: Boolean(business?.leadQualificationEnabled && business.leadIdealProfile?.trim()),
    idealProfile: business?.leadIdealProfile ?? "",
  };
}

export async function updateLeadQualificationSettings(
  businessId: string,
  settings: LeadQualificationSettings
): Promise<void> {
  await prisma.business.update({
    where: { id: businessId },
    data: { leadQualificationEnabled: settings.enabled, leadIdealProfile: settings.idealProfile || null },
  });

  // Al apagar la calificación, las que estaban esperando análisis se
  // liberan (vuelven a "sin calificar") para que Nodo las sincronice como
  // antes — si no, quedarían trabadas en "pending" para siempre.
  if (!settings.enabled) {
    await prisma.inquiry.updateMany({
      where: { businessId, qualificationStatus: "pending" },
      data: { qualificationStatus: null, qualificationReason: null },
    });
  }
}

// ── Prompt y parseo (puros, testeables) ───────────────────────────────────

export function buildTranscript(messages: ConversationMessage[], businessName: string): string {
  return messages
    .filter((m) => m.text?.trim())
    .slice(-TRANSCRIPT_MAX_MESSAGES)
    .map((m) => `${m.sender === "customer" ? "Cliente" : businessName || "Negocio"}: ${m.text.trim()}`)
    .join("\n");
}

export function buildQualificationPrompt(input: { businessName: string; idealProfile: string }): BuiltPrompt {
  const systemInstruction = `Sos un analista comercial. Leés una conversación de WhatsApp entre un negocio y una persona que le escribió, y decidís si esa persona es un potencial cliente para ESTE negocio según la descripción de lead ideal que el negocio escribió.

NEGOCIO: ${input.businessName || "(sin nombre)"}

LEAD IDEAL (escrito por el negocio, es tu único criterio):
"""
${input.idealProfile.trim()}
"""

Decisiones posibles:
- "qualified": la conversación muestra que la persona encaja con el lead ideal y tiene interés real.
- "discarded": la conversación muestra que la persona NO encaja (está fuera de la zona, del rubro, del perfil, busca otra cosa, es spam, es un proveedor ofreciendo algo, etc.).
- "unclear": todavía no hay información suficiente para decidir (por ejemplo solo saludó o hizo una pregunta genérica). Ante la duda, elegí "unclear": es preferible esperar más mensajes que descartar a alguien que sí servía.

Reglas:
- Basate SOLO en lo que dice la conversación. No inventes datos.
- Lo que dice el negocio en la conversación también cuenta como contexto (por ejemplo, si ya le preguntó la zona y la persona respondió).
- "reason": una frase corta en español rioplatense explicando el porqué, para que el dueño la lea (ej: "Tiene una pizzería en Caballito y quiere sumarse a Rappi").

Respondé EXCLUSIVAMENTE un JSON válido, sin texto adicional y sin fence de código:
{"decision": "qualified" | "discarded" | "unclear", "reason": "..."}`;

  return { systemInstruction };
}

export function parseQualificationResponse(raw: string): { decision: QualificationDecision; reason: string } | null {
  const fenced = raw.match(JSON_FENCE);
  const jsonText = (fenced ? fenced[1] : raw).trim();
  try {
    const parsed = responseSchema.safeParse(JSON.parse(jsonText));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// ── Análisis ──────────────────────────────────────────────────────────────

function geminiProvider(): GeminiProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GeminiProvider(apiKey);
}

interface QualifyInput {
  businessId: string;
  contactPhone: string;
  messages: ConversationMessage[];
}

const attempts = new Map<string, number>();

// Analiza la consulta "pending" más reciente de este número. Nunca lanza.
// Devuelve qué pasó (útil para tests y logs).
export async function qualifyPendingInquiry(
  input: QualifyInput
): Promise<"no_pending" | "disabled" | "no_customer_text" | "max_attempts" | "ai_error" | QualificationDecision> {
  try {
    const settings = await getLeadQualificationSettings(input.businessId);
    if (!settings.enabled) return "disabled";

    const since = new Date(Date.now() - WHATSAPP_LEAD_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const inquiry = await prisma.inquiry.findFirst({
      where: {
        businessId: input.businessId,
        customerWhatsapp: input.contactPhone,
        source: "whatsapp",
        qualificationStatus: "pending",
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!inquiry) return "no_pending";

    if (!input.messages.some((m) => m.sender === "customer" && m.text?.trim())) return "no_customer_text";

    const used = attempts.get(inquiry.id) ?? 0;
    if (used >= MAX_ATTEMPTS_PER_INQUIRY) return "max_attempts";
    attempts.set(inquiry.id, used + 1);

    const provider = geminiProvider();
    if (!provider) return "ai_error";

    const business = await prisma.business.findUnique({ where: { id: input.businessId }, select: { name: true } });
    const businessName = business?.name ?? "";

    const raw = await provider.generateResponse(
      `Conversación:\n${buildTranscript(input.messages, businessName)}\n\nCalificá ahora, en el formato indicado.`,
      [],
      buildQualificationPrompt({ businessName, idealProfile: settings.idealProfile }),
      { businessId: input.businessId, operation: "lead_qualification" }
    );

    const result = parseQualificationResponse(raw);
    if (!result) {
      console.error("[Leads] Respuesta de calificación inválida:", raw);
      return "ai_error";
    }

    // "unclear": sigue pending, pero se guarda el motivo para que el dueño
    // vea en qué está ("Todavía no dijo dónde está el local").
    // where con qualificationStatus "pending": si el dueño ya decidió a mano
    // mientras corría el análisis, esto no matchea y no pisa nada.
    await prisma.inquiry.updateMany({
      where: { id: inquiry.id, businessId: input.businessId, qualificationStatus: "pending" },
      data:
        result.decision === "unclear"
          ? { qualificationReason: result.reason }
          : { qualificationStatus: result.decision, qualificationReason: result.reason },
    });

    if (result.decision !== "unclear") attempts.delete(inquiry.id);
    return result.decision;
  } catch (error) {
    console.error("[Leads] Error calificando consulta:", error);
    return "ai_error";
  }
}

// ── Debounce ──────────────────────────────────────────────────────────────

const timers = new Map<string, ReturnType<typeof setTimeout>>();

// Reprograma el análisis de este chat para dentro de QUIET_MS. Lo llama el
// manejador de WhatsApp en cada mensaje del cliente; `getMessages` se
// evalúa recién al disparar, así el análisis ve la charla completa hasta ese
// momento. Los timers viven en memoria: si el servidor se reinicia, una
// consulta pending se vuelve a analizar con el próximo mensaje del cliente.
export function scheduleLeadQualification(input: {
  businessId: string;
  jid: string;
  contactPhone: string;
  getMessages: () => ConversationMessage[];
}): void {
  if (!input.contactPhone) return;
  const key = `${input.businessId}:${input.jid}`;
  const existing = timers.get(key);
  if (existing) clearTimeout(existing);

  timers.set(
    key,
    setTimeout(() => {
      timers.delete(key);
      void qualifyPendingInquiry({
        businessId: input.businessId,
        contactPhone: input.contactPhone,
        messages: input.getMessages(),
      });
    }, QUIET_MS)
  );
}
