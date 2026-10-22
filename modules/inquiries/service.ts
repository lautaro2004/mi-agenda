import { prisma } from "@/lib/prisma";
import { notifyInquiryReceived } from "@/modules/notifications/service";
import { syncInquiryToNodo } from "@/modules/inquiries/nodo-sync";
import type { InquiryStatus } from "@/lib/schemas";
import type { InquiryQualificationStatus, InquirySource } from "@/lib/types";

export interface CreateInquiryInput {
  businessId: string;
  customerName: string;
  customerWhatsapp: string;
  customerEmail: string | null;
  message: string;
  // Sin valor = "web_form" (default de la columna).
  source?: InquirySource;
  // Solo "pending" al nacer (calificación activa); sin valor = sin calificar.
  qualificationStatus?: Extract<InquiryQualificationStatus, "pending">;
}

// Único punto de escritura de una consulta pública (las del asistente
// pasan por modules/inquiries/capture.ts). La notificación es
// best-effort (createNotification nunca lanza): si falla, la consulta ya
// quedó guardada igual.
// Arma el texto final de la consulta. Los datos extra del formulario de
// captación (negocio, zona) no tienen columna propia en Inquiry — se
// anteponen al mensaje para que el dueño los vea en Consultas sin migración.
export function composeInquiryMessage(input: { message: string; companyName?: string; location?: string }): string {
  const header = [
    input.companyName ? `Negocio: ${input.companyName}` : null,
    input.location ? `Zona: ${input.location}` : null,
  ].filter(Boolean);
  if (header.length === 0) return input.message;
  return `${header.join(" · ")}\n\n${input.message}`;
}

export async function createInquiry(input: CreateInquiryInput) {
  const inquiry = await prisma.inquiry.create({
    data: {
      businessId: input.businessId,
      customerName: input.customerName,
      customerWhatsapp: input.customerWhatsapp,
      customerEmail: input.customerEmail,
      message: input.message,
      ...(input.source ? { source: input.source } : {}),
      ...(input.qualificationStatus ? { qualificationStatus: input.qualificationStatus } : {}),
    },
  });

  await notifyInquiryReceived({
    businessId: inquiry.businessId,
    inquiryId: inquiry.id,
    customerName: inquiry.customerName,
  });

  // Si el negocio tiene Nodo CRM, crea o actualiza el lead allá (nunca
  // lanza; sin configuración es un no-op).
  await syncInquiryToNodo(inquiry.businessId, inquiry.id);

  return inquiry;
}

export async function listInquiries(businessId: string) {
  return prisma.inquiry.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });
}

// updateMany con businessId en el where: un id de otro negocio nunca matchea
// (mismo criterio que markNotificationRead). Devuelve false si no se actualizó
// nada, para que la ruta responda 404 en vez de un éxito falso.
export async function updateInquiryStatus(
  businessId: string,
  id: string,
  update: { status?: InquiryStatus; qualificationStatus?: "qualified" | "discarded" }
): Promise<boolean> {
  const { count } = await prisma.inquiry.updateMany({
    where: { id, businessId },
    data: {
      ...(update.status ? { status: update.status } : {}),
      // Decisión manual del dueño: reemplaza el motivo de la IA para que no
      // quede un "Descartado porque…" contradiciendo un "Calificado".
      ...(update.qualificationStatus
        ? { qualificationStatus: update.qualificationStatus, qualificationReason: "Marcado a mano" }
        : {}),
    },
  });
  return count > 0;
}
