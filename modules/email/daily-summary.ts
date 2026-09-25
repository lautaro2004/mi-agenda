import { prisma } from "@/lib/prisma";
import { dailySummaryEmail } from "./templates";
import { getOwnerEmail, sendPlatformEmail } from "./send";
import { getLocalNow } from "./time";

// Resumen diario al DUEÑO: es un aviso propio de la plataforma, sale por Resend
// con el remitente de Kodexa (no desde el correo del negocio hacia sí mismo).
//
// Se envía cuando la hora local (Argentina) está en [hora configurada, +1]: la
// ventana de una hora extra absorbe demoras del scheduler externo sin mandar
// un "resumen de hoy" a la noche. Idempotencia: reclamo atómico sobre
// lastDailySummaryDate + Idempotency-Key por negocio/día.
const CANCELLED_STATUSES = ["cancelled", "no_show"];

export async function sendDailySummaries(now: Date = new Date()): Promise<{ sent: number; failed: number }> {
  const { date: today, hour } = getLocalNow(now);

  const due = await prisma.emailNotificationSettings.findMany({
    where: {
      dailySummaryEnabled: true,
      dailySummaryHour: { gte: hour - 1, lte: hour },
      OR: [{ lastDailySummaryDate: null }, { lastDailySummaryDate: { not: today } }],
    },
    select: { businessId: true, lastDailySummaryDate: true },
  });

  let sent = 0;
  let failed = 0;

  for (const row of due) {
    const previous = row.lastDailySummaryDate;

    const claim = await prisma.emailNotificationSettings.updateMany({
      where: {
        businessId: row.businessId,
        OR: [{ lastDailySummaryDate: null }, { lastDailySummaryDate: { not: today } }],
      },
      data: { lastDailySummaryDate: today },
    });
    if (claim.count === 0) continue;

    const release = () =>
      prisma.emailNotificationSettings.updateMany({
        where: { businessId: row.businessId },
        data: { lastDailySummaryDate: previous },
      });

    try {
      const ownerEmail = await getOwnerEmail(row.businessId);
      if (!ownerEmail) {
        await release();
        continue;
      }

      const business = await prisma.business.findUnique({ where: { id: row.businessId }, select: { name: true } });
      const appointments = await prisma.appointment.findMany({
        // Solo los turnos de ESTE negocio.
        where: { businessId: row.businessId, date: today, status: { notIn: CANCELLED_STATUSES } },
        orderBy: { startTime: "asc" },
      });

      const email = dailySummaryEmail({
        businessName: business?.name ?? "Tu negocio",
        date: today,
        appointments: appointments.map((a) => ({
          startTime: a.startTime,
          endTime: a.endTime,
          customerName: a.customerName,
          serviceName: a.serviceName,
          pendingPayment: a.status === "pending_payment",
        })),
      });

      const result = await sendPlatformEmail({
        to: ownerEmail,
        ...email,
        idempotencyKey: `daily-summary/${row.businessId}/${today}`,
      });

      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
        await release();
        console.error("[email] Falló el resumen diario:", result.error);
      }
    } catch (error) {
      failed += 1;
      await release();
      console.error("[email] Error enviando el resumen diario:", error instanceof Error ? error.message : "desconocido");
    }
  }

  return { sent, failed };
}
