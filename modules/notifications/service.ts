import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Centro de notificaciones del negocio — ver comentario en el modelo
// BusinessNotification (prisma/schema.prisma). Único punto de escritura:
// nunca se crea una fila de esta tabla desde otro lado del código, siempre
// pasando por las funciones notify*() de más abajo, enganchadas en el mismo
// choke point que ya usa cada feature real (createAppointment,
// cancelAppointment, submitProofForAppointment, el hand-off a humano de
// WhatsApp, el corte de límite de IA) — nunca una notificación por cada
// interacción de IA, solo estos 6 eventos puntuales.
export const NOTIFICATION_TYPES = [
  "human_required",
  "booking_created",
  "booking_pending",
  "booking_cancelled",
  "payment_proof_received",
  "ai_limit_reached",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

interface CreateNotificationInput {
  businessId: string;
  type: NotificationType;
  title: string;
  body: string;
  resourceHref?: string | null;
  payload?: Record<string, unknown>;
}

// Best-effort a propósito: crear una notificación NUNCA debe poder tirar
// abajo el flujo real que la origina (una reserva, un comprobante, una
// respuesta de WhatsApp). Cada notify*() de abajo llama a esto sin esperar
// que el caller haga su propio try/catch.
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    await prisma.businessNotification.create({
      data: {
        businessId: input.businessId,
        type: input.type,
        title: input.title,
        body: input.body,
        resourceHref: input.resourceHref ?? null,
        payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    console.error("[notifications] No pudimos crear la notificación:", {
      type: input.type,
      businessId: input.businessId,
      error,
    });
  }
}

export async function listNotifications(businessId: string, limit = 30) {
  return prisma.businessNotification.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function countUnreadNotifications(businessId: string): Promise<number> {
  return prisma.businessNotification.count({ where: { businessId, readAt: null } });
}

// updateMany (no update) porque nunca falla si el id ya no existe o es de
// otro negocio — where incluye businessId a propósito, mismo criterio de
// autorización que el resto de las rutas /api/business/*: nunca confiar en
// un id suelto del cliente sin scopearlo.
export async function markNotificationRead(businessId: string, id: string): Promise<void> {
  await prisma.businessNotification.updateMany({
    where: { id, businessId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(businessId: string): Promise<void> {
  await prisma.businessNotification.updateMany({
    where: { businessId, readAt: null },
    data: { readAt: new Date() },
  });
}

function formatAppointmentWhen(date: string, startTime: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const formatted = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(y, m - 1, d)
  );
  return `${formatted} a las ${startTime}`;
}

// ── Eventos reales, uno por caso de la sección 4 del pedido ────────────────

interface AppointmentNotifyInput {
  businessId: string;
  id: string;
  customerName: string;
  serviceName: string;
  date: string;
  startTime: string;
}

export async function notifyBookingCreated(appt: AppointmentNotifyInput): Promise<void> {
  await createNotification({
    businessId: appt.businessId,
    type: "booking_created",
    title: "Nueva reserva",
    body: `${appt.customerName} reservó ${appt.serviceName} para el ${formatAppointmentWhen(appt.date, appt.startTime)}.`,
    resourceHref: "/dashboard/turnos",
    payload: { appointmentId: appt.id },
  });
}

export async function notifyBookingPending(appt: AppointmentNotifyInput): Promise<void> {
  await createNotification({
    businessId: appt.businessId,
    type: "booking_pending",
    title: "Reserva pendiente de confirmación",
    body: `${appt.customerName} reservó ${appt.serviceName} para el ${formatAppointmentWhen(appt.date, appt.startTime)}. Requiere confirmar el pago.`,
    resourceHref: "/dashboard/turnos",
    payload: { appointmentId: appt.id },
  });
}

export async function notifyBookingCancelled(appt: AppointmentNotifyInput): Promise<void> {
  await createNotification({
    businessId: appt.businessId,
    type: "booking_cancelled",
    title: "Reserva cancelada",
    body: `${appt.customerName} canceló su turno de ${appt.serviceName} del ${formatAppointmentWhen(appt.date, appt.startTime)}.`,
    resourceHref: "/dashboard/turnos",
    payload: { appointmentId: appt.id },
  });
}

export async function notifyPaymentProofReceived(input: {
  businessId: string;
  appointmentId?: string | null;
  customerName?: string | null;
}): Promise<void> {
  await createNotification({
    businessId: input.businessId,
    type: "payment_proof_received",
    title: "Comprobante recibido",
    body: input.customerName
      ? `${input.customerName} envió un comprobante de pago para revisar.`
      : "Llegó un comprobante de pago para revisar.",
    resourceHref: "/dashboard/turnos",
    payload: { appointmentId: input.appointmentId ?? null },
  });
}

export async function notifyHumanRequired(input: {
  businessId: string;
  jid: string;
  contactName?: string | null;
}): Promise<void> {
  await createNotification({
    businessId: input.businessId,
    type: "human_required",
    title: "Requiere atención humana",
    body: `${input.contactName || "Un cliente"} pidió hablar con una persona por WhatsApp.`,
    resourceHref: `/dashboard/whatsapp/conversaciones/${encodeURIComponent(input.jid)}`,
    payload: { jid: input.jid },
  });
}

export async function notifyAiLimitReached(input: { businessId: string; limit: number }): Promise<void> {
  await createNotification({
    businessId: input.businessId,
    type: "ai_limit_reached",
    title: "Límite de IA alcanzado",
    body: `Tu negocio alcanzó las ${input.limit} respuestas de IA incluidas en tu plan para este período.`,
    resourceHref: "/dashboard/suscripcion",
  });
}
