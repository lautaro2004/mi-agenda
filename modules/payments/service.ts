import { prisma } from "@/lib/prisma";
import { PAYMENT_PROOF_LIMITS } from "@/lib/payment-proof-limits";
import {
  buildPaymentProofPath,
  deletePaymentProof,
  ensurePaymentProofsBucketExists,
  getSignedProofUrl,
  uploadPaymentProof,
} from "@/lib/payment-proofs";
import { findPendingPaymentAppointments } from "@/modules/appointments/service";

export class PaymentProofValidationError extends Error {}

interface IncomingFile {
  bytes: Buffer;
  mimeType: string;
  fileName?: string | null;
}

function validateFile(file: IncomingFile): void {
  if (!file.bytes || file.bytes.length === 0) {
    throw new PaymentProofValidationError("El archivo llegó vacío o dañado.");
  }
  if (!PAYMENT_PROOF_LIMITS.mimeTypes.includes(file.mimeType)) {
    throw new PaymentProofValidationError("Ese formato de archivo no está soportado.");
  }
  if (file.bytes.length > PAYMENT_PROOF_LIMITS.maxBytes) {
    throw new PaymentProofValidationError(
      `El archivo supera el máximo de ${Math.round(PAYMENT_PROOF_LIMITS.maxBytes / (1024 * 1024))} MB.`,
    );
  }
}

// Delegado a modules/appointments/service.ts (fuente única de verdad de
// Appointment) — ver sección 6 de la tarea: detección estructural vía
// Postgres, nunca solo texto libre.
export { findPendingPaymentAppointments };

// Sube el archivo y lo asocia directo cuando ya sabemos a qué turno
// corresponde (caso normal: un único turno pendiente de pago para ese
// teléfono). Verifica que el turno sea realmente de este negocio y esté en
// un estado que admita un comprobante nuevo — nunca confía en el
// appointmentId sin revalidar contra businessId (ver sección 11 de la
// tarea).
export async function submitProofForAppointment(params: {
  businessId: string;
  appointmentId: string;
  file: IncomingFile;
}) {
  validateFile(params.file);

  const appointment = await prisma.appointment.findFirst({
    where: { id: params.appointmentId, businessId: params.businessId },
  });
  if (!appointment) return { error: "not_found" as const };
  if (!["pending_payment", "payment_rejected"].includes(appointment.status)) {
    return { error: "invalid_state" as const };
  }

  await ensurePaymentProofsBucketExists();
  const storagePath = buildPaymentProofPath(params.businessId, appointment.id, params.file.mimeType);
  await uploadPaymentProof(storagePath, params.file.bytes, params.file.mimeType);

  const [proof, updated] = await prisma.$transaction([
    prisma.paymentProof.create({
      data: {
        businessId: params.businessId,
        appointmentId: appointment.id,
        storagePath,
        originalFileName: params.file.fileName ?? null,
        mimeType: params.file.mimeType,
        fileSizeBytes: params.file.bytes.length,
      },
    }),
    prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "payment_submitted" },
    }),
  ]);

  return { proof, appointment: updated };
}

// Sube el archivo SIN asociarlo todavía — caso de más de un turno pendiente
// de pago para el mismo teléfono (ver sección 6 de la tarea): se guarda para
// no perderlo mientras se le pregunta al cliente a cuál corresponde.
export async function submitUnassignedProof(params: { businessId: string; file: IncomingFile }) {
  validateFile(params.file);

  await ensurePaymentProofsBucketExists();
  const storagePath = buildPaymentProofPath(params.businessId, null, params.file.mimeType);
  await uploadPaymentProof(storagePath, params.file.bytes, params.file.mimeType);

  return prisma.paymentProof.create({
    data: {
      businessId: params.businessId,
      appointmentId: null,
      storagePath,
      originalFileName: params.file.fileName ?? null,
      mimeType: params.file.mimeType,
      fileSizeBytes: params.file.bytes.length,
    },
  });
}

// Completa el vínculo una vez que el cliente contestó a cuál turno
// corresponde el comprobante que ya se subió sin asignar.
export async function assignProofToAppointment(params: {
  businessId: string;
  proofId: string;
  appointmentId: string;
}) {
  const proof = await prisma.paymentProof.findFirst({
    where: { id: params.proofId, businessId: params.businessId, appointmentId: null },
  });
  if (!proof) return { error: "not_found" as const };

  const appointment = await prisma.appointment.findFirst({
    where: { id: params.appointmentId, businessId: params.businessId },
  });
  if (!appointment) return { error: "not_found" as const };
  if (!["pending_payment", "payment_rejected"].includes(appointment.status)) {
    return { error: "invalid_state" as const };
  }

  const [updatedProof, updatedAppointment] = await prisma.$transaction([
    prisma.paymentProof.update({ where: { id: proof.id }, data: { appointmentId: appointment.id } }),
    prisma.appointment.update({ where: { id: appointment.id }, data: { status: "payment_submitted" } }),
  ]);

  return { proof: updatedProof, appointment: updatedAppointment };
}

export async function getLatestProof(businessId: string, appointmentId: string) {
  return prisma.paymentProof.findFirst({
    where: { businessId, appointmentId },
    orderBy: { uploadedAt: "desc" },
  });
}

// Detalle completo para el dashboard (ver sección 8 de la tarea): siempre
// escaneado por businessId — nunca se confía en un appointmentId suelto sin
// verificar que sea de este negocio (sección 11, "nunca permitir que un
// negocio acceda a comprobantes de otro").
export async function getPaymentDetailForOwner(businessId: string, appointmentId: string) {
  const appointment = await prisma.appointment.findFirst({ where: { id: appointmentId, businessId } });
  if (!appointment) return null;

  const proofs = await prisma.paymentProof.findMany({
    where: { businessId, appointmentId },
    orderBy: { uploadedAt: "desc" },
  });

  const latest = proofs[0] ?? null;
  let signedUrl: string | null = null;
  if (latest) {
    try {
      signedUrl = await getSignedProofUrl(latest.storagePath);
    } catch (error) {
      console.error("[payments] No pudimos generar la signed URL:", { businessId, appointmentId, error });
    }
  }

  return { appointment, proofs, signedUrl };
}

function formatAppointmentDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(y, m - 1, d),
  );
}

async function notifyCustomer(appointment: { businessId: string; customerPhone: string }, text: string) {
  try {
    const { whatsappConnectionManager } = await import("@/modules/whatsapp/connection/manager");
    const { phoneToJid } = await import("@/modules/whatsapp/messages/sync");
    await whatsappConnectionManager.sendMessage(
      appointment.businessId,
      phoneToJid(appointment.customerPhone),
      text,
      "ai",
    );
  } catch (error) {
    // Best effort: si WhatsApp está desconectado, la confirmación/rechazo en
    // el dashboard igual debe quedar registrada — el dueño puede avisarle
    // al cliente por otro medio.
    console.error("[payments] No pudimos enviar el mensaje de WhatsApp:", error);
  }
}

type ReviewError = { error: "not_found" | "invalid_state" };
type ReviewResult = { ok: true; appointment: Awaited<ReturnType<typeof prisma.appointment.update>>; alreadyDone: boolean };

// Idempotente a propósito (ver sección 9 de la tarea): si el turno ya está
// "confirmed", no vuelve a tocar el comprobante ni a mandar un segundo
// mensaje de WhatsApp — devuelve el estado actual con alreadyDone = true.
export async function confirmPayment(params: {
  businessId: string;
  appointmentId: string;
  reviewedBy: string;
}): Promise<ReviewResult | ReviewError> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: params.appointmentId, businessId: params.businessId },
  });
  if (!appointment) return { error: "not_found" };
  if (appointment.status === "confirmed") return { ok: true, appointment, alreadyDone: true };
  if (!["payment_submitted", "pending_payment"].includes(appointment.status)) {
    return { error: "invalid_state" };
  }

  const now = new Date();
  const latest = await getLatestProof(params.businessId, appointment.id);

  // El update del turno siempre va último en la transacción — nunca asumir
  // su posición por índice fijo, porque el update del comprobante es
  // condicional (latest puede ser null si el dueño confirma sin que haya
  // llegado un comprobante todavía, ver el estado "pending_payment" arriba).
  const ops = [
    ...(latest
      ? [
          prisma.paymentProof.update({
            where: { id: latest.id },
            data: { status: "approved", reviewedAt: now, reviewedBy: params.reviewedBy },
          }),
        ]
      : []),
    prisma.appointment.update({ where: { id: appointment.id }, data: { status: "confirmed" } }),
  ];
  const results = await prisma.$transaction(ops);
  const updated = results[results.length - 1] as Awaited<ReturnType<typeof prisma.appointment.update>>;

  await notifyCustomer(
    updated,
    `¡Listo! Confirmamos tu pago 🎉 Tu turno para ${updated.serviceName} el ${formatAppointmentDate(updated.date)} a las ${updated.startTime} quedó confirmado. ¡Te esperamos!`,
  );

  return { ok: true, appointment: updated, alreadyDone: false };
}

// Idempotente igual que confirmPayment: repetir el rechazo no reescribe el
// motivo ni reenvía el mensaje.
export async function rejectPayment(params: {
  businessId: string;
  appointmentId: string;
  reviewedBy: string;
  reason?: string;
}): Promise<ReviewResult | ReviewError> {
  const appointment = await prisma.appointment.findFirst({
    where: { id: params.appointmentId, businessId: params.businessId },
  });
  if (!appointment) return { error: "not_found" };
  if (appointment.status === "payment_rejected") return { ok: true, appointment, alreadyDone: true };
  if (appointment.status !== "payment_submitted") return { error: "invalid_state" };

  const now = new Date();
  const latest = await getLatestProof(params.businessId, appointment.id);
  const reason = params.reason?.trim() || undefined;

  // Mismo criterio que confirmPayment: el update del turno va último, nunca
  // se asume su posición por índice fijo.
  const ops = [
    ...(latest
      ? [
          prisma.paymentProof.update({
            where: { id: latest.id },
            data: { status: "rejected", reviewedAt: now, reviewedBy: params.reviewedBy, rejectionReason: reason },
          }),
        ]
      : []),
    prisma.appointment.update({ where: { id: appointment.id }, data: { status: "payment_rejected" } }),
  ];
  const results = await prisma.$transaction(ops);
  const updated = results[results.length - 1] as Awaited<ReturnType<typeof prisma.appointment.update>>;

  await notifyCustomer(
    updated,
    `Revisamos el comprobante que enviaste y no pudimos validarlo${reason ? ` (${reason})` : ""}. Podés responder este mensaje con un nuevo comprobante para confirmar tu turno del ${formatAppointmentDate(updated.date)} a las ${updated.startTime}.`,
  );

  return { ok: true, appointment: updated, alreadyDone: false };
}

// Métrica rápida para el dashboard (sección 14 de la tarea): "Pagos
// pendientes de validar: N".
export async function countPendingProofReviews(businessId: string): Promise<number> {
  return prisma.appointment.count({ where: { businessId, status: "payment_submitted" } });
}

export async function listPendingProofAppointments(businessId: string, limit = 5) {
  return prisma.appointment.findMany({
    where: { businessId, status: "payment_submitted" },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

// Barrido de comprobantes huérfanos (sección 12 de la tarea): un comprobante
// nunca se borra solo por antigüedad si sigue asociado a un turno — eso es
// evidencia de pago y se conserva siempre, aunque el turno haya sido
// rechazado o cancelado. Solo son candidatos los que quedaron con
// appointmentId = null (el cliente nunca contestó a cuál turno
// correspondía) y superan el período de gracia.
const ORPHAN_PROOF_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

export async function cleanupOrphanPaymentProofs(): Promise<{ checked: number; deleted: number }> {
  const cutoff = new Date(Date.now() - ORPHAN_PROOF_GRACE_PERIOD_MS);
  const orphans = await prisma.paymentProof.findMany({
    where: { appointmentId: null, uploadedAt: { lt: cutoff } },
  });

  let deleted = 0;
  for (const orphan of orphans) {
    try {
      await deletePaymentProof(orphan.storagePath);
      await prisma.paymentProof.delete({ where: { id: orphan.id } });
      deleted++;
    } catch (error) {
      console.error(`[payments] Cleanup no pudo borrar el comprobante huérfano ${orphan.id}:`, error);
    }
  }

  return { checked: orphans.length, deleted };
}
