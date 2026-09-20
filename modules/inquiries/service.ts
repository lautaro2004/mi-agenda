import { prisma } from "@/lib/prisma";
import { notifyInquiryReceived } from "@/modules/notifications/service";
import type { InquiryStatus } from "@/lib/schemas";

export interface CreateInquiryInput {
  businessId: string;
  customerName: string;
  customerWhatsapp: string;
  customerEmail: string;
  message: string;
}

// Único punto de escritura de una consulta pública. La notificación es
// best-effort (createNotification nunca lanza): si falla, la consulta ya
// quedó guardada igual.
export async function createInquiry(input: CreateInquiryInput) {
  const inquiry = await prisma.inquiry.create({
    data: {
      businessId: input.businessId,
      customerName: input.customerName,
      customerWhatsapp: input.customerWhatsapp,
      customerEmail: input.customerEmail,
      message: input.message,
    },
  });

  await notifyInquiryReceived({
    businessId: inquiry.businessId,
    inquiryId: inquiry.id,
    customerName: inquiry.customerName,
  });

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
export async function updateInquiryStatus(businessId: string, id: string, status: InquiryStatus): Promise<boolean> {
  const { count } = await prisma.inquiry.updateMany({
    where: { id, businessId },
    data: { status },
  });
  return count > 0;
}
