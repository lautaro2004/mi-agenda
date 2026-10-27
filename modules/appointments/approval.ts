import { prisma } from "@/lib/prisma";
import { sendBookingConfirmation, sendBookingDeclined } from "@/modules/email/booking-emails";

// Aprobación de reservas (agenda inteligente). Una reserva "pendiente de
// aprobación" es un Appointment con status "pending" Y approvalExpiresAt
// definido: retiene el horario (pending cuenta como activo, ver
// ACTIVE_STATUSES) hasta que el dueño decide o vence el plazo.
//
// Todas las transiciones son UPDATE condicionales (updateMany sobre el estado
// esperado): si el dueño aprueba justo cuando corre el barrido de
// vencimientos, o toca dos veces, solo una gana y la otra no hace nada.

const AWAITING = { status: "pending", approvalExpiresAt: { not: null } } as const;

export type ApprovalResult =
  | { error?: undefined; appointment: NonNullable<Awaited<ReturnType<typeof prisma.appointment.findUnique>>> }
  | { error: "not_found" | "expired"; appointment?: undefined };

export async function approveAppointment(businessId: string, id: string, now: Date = new Date()): Promise<ApprovalResult> {
  const row = await prisma.appointment.findFirst({
    where: { id, businessId, ...AWAITING },
    select: { id: true, approvalExpiresAt: true, depositAmount: true },
  });
  if (!row) return { error: "not_found" };
  // Venció pero el barrido todavía no la liberó: ya no se puede aprobar.
  if (row.approvalExpiresAt && row.approvalExpiresAt <= now) return { error: "expired" };

  // Con seña, recién ahora corresponde pedir el pago; sin seña, queda confirmada.
  const claim = await prisma.appointment.updateMany({
    where: { id: row.id, businessId, ...AWAITING, approvalExpiresAt: { gt: now } },
    data: { status: row.depositAmount != null ? "pending_payment" : "confirmed", approvalExpiresAt: null },
  });
  if (claim.count === 0) return { error: "not_found" };

  const appointment = await prisma.appointment.findUnique({ where: { id: row.id } });
  if (!appointment) return { error: "not_found" };
  await sendBookingConfirmation(row.id);
  return { appointment };
}

export async function rejectAppointment(businessId: string, id: string): Promise<ApprovalResult> {
  const claim = await prisma.appointment.updateMany({
    where: { id, businessId, ...AWAITING },
    data: { status: "cancelled", approvalExpiresAt: null },
  });
  if (claim.count === 0) return { error: "not_found" };

  const appointment = await prisma.appointment.findUnique({ where: { id } });
  if (!appointment) return { error: "not_found" };
  await sendBookingDeclined(id, "rejected");
  return { appointment };
}

// Barrido (lo invoca el cron de cada 10 minutos): cancela las solicitudes que
// nadie respondió a tiempo, libera el horario y avisa al cliente. Idempotente.
export async function expirePendingApprovals(now: Date = new Date(), limit = 200): Promise<{ expired: number }> {
  const due = await prisma.appointment.findMany({
    where: { status: "pending", approvalExpiresAt: { lte: now } },
    select: { id: true },
    take: limit,
  });

  let expired = 0;
  for (const { id } of due) {
    const claim = await prisma.appointment.updateMany({
      where: { id, status: "pending", approvalExpiresAt: { lte: now } },
      data: { status: "cancelled", approvalExpiresAt: null },
    });
    if (claim.count === 0) continue; // otra acción se adelantó
    expired += 1;
    await sendBookingDeclined(id, "expired");
  }
  return { expired };
}
