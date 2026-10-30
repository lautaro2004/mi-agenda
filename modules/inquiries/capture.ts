import { prisma } from "@/lib/prisma";
import { notifyInquiryReceived } from "@/modules/notifications/service";
import { syncInquiryToNodo, type NodoSyncStatus } from "@/modules/inquiries/nodo-sync";
import { isLeadQualificationActive } from "@/modules/inquiries/qualification";

// Registro de un interesado captado por el asistente (WhatsApp). Vive en
// nexo.Inquiry — la misma tabla que las consultas del sitio web, con
// channel = "whatsapp" — así el negocio lo ve en Consultas aunque no tenga
// Nodo CRM, y Nodo lo sigue pudiendo leer como siempre.
//
// Reglas:
// - Un interesado abierto por conversación: si ya hay uno sin resolver para
//   la misma conversación (o el mismo teléfono), se ACTUALIZA (necesidad,
//   resumen, datos vacíos) en vez de crear otro.
// - Si ya estaba resuelto, una nueva consulta abre un registro nuevo.
// - El resultado es explícito ({ ok }) y se confirma ANTES de que el
//   asistente le diga al cliente que sus datos quedaron registrados.

export interface CaptureLeadInput {
  businessId: string;
  channel: "whatsapp";
  conversationRef: string;
  name: string;
  phone: string;
  email?: string | null;
  need: string;
  summary?: string | null;
  // Campaña de WhatsApp de origen (opcional): se guarda con snapshot del
  // nombre y del método de atribución.
  campaign?: {
    id: string;
    name: string;
    method: string;
    // Tipo de solicitud: "proposal" | "lead" | "handoff".
    requestKind: "proposal" | "lead" | "handoff";
    data?: Record<string, unknown>;
    // false: no enviar a Nodo (la campaña lo desactivó).
    syncNodo?: boolean;
    // Estado inicial del interesado nuevo.
    initialStatus?: "NEW" | "IN_PROGRESS";
  };
}

export type CaptureLeadResult =
  | { ok: true; inquiryId: string; created: boolean; nodo: NodoSyncStatus }
  | { ok: false; reason: "invalid" | "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clean = (value: string | null | undefined, max: number) => (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Últimos 10 dígitos: mismo criterio de comparación que usa Nodo. */
export function phoneKey(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/[^0-9]/g, "");
  return digits.length >= 6 ? digits.slice(-10) : null;
}

export function normalizeCaptureInput(input: CaptureLeadInput) {
  const name = clean(input.name, 100);
  const need = clean(input.need, 300);
  const summary = clean(input.summary, 1000) || null;
  const phone = clean(input.phone, 30);
  const rawEmail = clean(input.email, 200).toLowerCase();
  const email = EMAIL_RE.test(rawEmail) ? rawEmail : "";
  const errors: string[] = [];
  if (name.length < 2) errors.push("nombre");
  if (need.length < 3) errors.push("necesidad");
  // Alcanza con un medio de contacto: teléfono o email (un contacto de WhatsApp
  // sin teléfono resoluble igual puede dejar su email).
  if (!phoneKey(phone) && !email) errors.push("teléfono o email");
  return { name, need, summary, phone, email, errors };
}

async function findOpenInquiry(businessId: string, channel: string, conversationRef: string, phone: string) {
  const byConversation = await prisma.inquiry.findFirst({
    where: { businessId, channel, conversationRef, status: { not: "RESOLVED" } },
    orderBy: { createdAt: "desc" },
  });
  if (byConversation) return byConversation;

  const key = phoneKey(phone);
  if (!key) return null;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "nexo"."Inquiry"
    WHERE "businessId" = ${businessId} AND status <> 'RESOLVED'
      AND right(regexp_replace("customerWhatsapp", '[^0-9]', '', 'g'), 10) = ${key}
    ORDER BY "createdAt" DESC LIMIT 1`;
  return rows[0] ? prisma.inquiry.findUnique({ where: { id: rows[0].id } }) : null;
}

/** ¿Ya hay un interesado abierto para esta conversación? (para el prompt) */
export async function getOpenInquiryForConversation(businessId: string, conversationRef: string) {
  return prisma.inquiry
    .findFirst({
      where: { businessId, channel: "whatsapp", conversationRef, status: { not: "RESOLVED" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, customerName: true, need: true },
    })
    .catch(() => null);
}

export async function captureLead(input: CaptureLeadInput): Promise<CaptureLeadResult> {
  const data = normalizeCaptureInput(input);
  if (data.errors.length) {
    return { ok: false, reason: "invalid", message: `Faltan datos: ${data.errors.join(", ")}` };
  }

  let inquiryId: string;
  let created: boolean;
  try {
    const existing = await findOpenInquiry(input.businessId, input.channel, input.conversationRef, data.phone);
    if (existing) {
      await prisma.inquiry.update({
        where: { id: existing.id },
        data: {
          need: data.need,
          ...(data.summary ? { summary: data.summary } : {}),
          // Nunca se pisa lo que ya estaba cargado: solo se completan vacíos.
          ...(!existing.customerEmail && data.email ? { customerEmail: data.email } : {}),
          ...(!existing.conversationRef ? { conversationRef: input.conversationRef } : {}),
          // La campaña de origen no se pisa; solo se completa si faltaba.
          ...(input.campaign && !existing.campaignId
            ? { campaignId: input.campaign.id, campaignName: input.campaign.name, attributionMethod: input.campaign.method }
            : {}),
          ...(input.campaign
            ? {
                // "proposal" gana sobre "lead": una solicitud de propuesta no se degrada.
                ...(!existing.requestKind || (existing.requestKind !== "proposal" && input.campaign.requestKind === "proposal") ? { requestKind: input.campaign.requestKind } : {}),
                ...(input.campaign.data ? { campaignData: input.campaign.data as object } : {}),
              }
            : {}),
        },
      });
      inquiryId = existing.id;
      created = false;
    } else {
      // Con la calificación con IA activa, el interesado nace "pending"
      // (mismo criterio que el detector de whatsapp-lead.ts): Nodo lo
      // recibe recién cuando quede "qualified".
      const qualificationActive = await isLeadQualificationActive(input.businessId);
      const row = await prisma.inquiry.create({
        data: {
          businessId: input.businessId,
          channel: input.channel,
          conversationRef: input.conversationRef,
          customerName: data.name,
          customerWhatsapp: data.phone,
          customerEmail: data.email,
          message: data.need,
          need: data.need,
          summary: data.summary,
          source: "whatsapp",
          ...(input.campaign
            ? {
                campaignId: input.campaign.id,
                campaignName: input.campaign.name,
                attributionMethod: input.campaign.method,
                requestKind: input.campaign.requestKind,
                ...(input.campaign.data ? { campaignData: input.campaign.data as object } : {}),
                ...(input.campaign.initialStatus ? { status: input.campaign.initialStatus } : {}),
              }
            : {}),
          ...(qualificationActive ? { qualificationStatus: "pending" } : {}),
        },
      });
      inquiryId = row.id;
      created = true;
    }
  } catch (error) {
    console.error("[inquiries/capture] No se pudo registrar el interesado:", error instanceof Error ? error.message : error);
    return { ok: false, reason: "error", message: "No se pudo guardar el registro" };
  }

  if (created) {
    await notifyInquiryReceived({ businessId: input.businessId, inquiryId, customerName: data.name, channel: input.channel });
  }
  // Un fallo de Nodo nunca pierde el interesado (ya está guardado arriba);
  // syncInquiryToNodo deja el error en la propia fila para poder reintentar.
  const nodo = input.campaign?.syncNodo === false ? "not_configured" : await syncInquiryToNodo(input.businessId, inquiryId);
  if (input.campaign) {
    console.log(`[campaigns] lead ${created ? "creado" : "actualizado"} inquiry=${inquiryId} campaña=${input.campaign.name} tipo=${input.campaign.requestKind} nodo=${nodo}`);
  }
  return { ok: true, inquiryId, created, nodo };
}
