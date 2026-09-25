import { prisma } from "@/lib/prisma";
import { appointmentReminderEmail, bookingConfirmationEmail, type BookingEmailData } from "./templates";
import { sendBusinessEmail } from "./send";
import { getEmailSettings, EMAIL_SETTINGS_DEFAULTS } from "./settings";
import { addDays, appointmentStart, getLocalNow } from "./time";

// Estados en los que tiene sentido avisarle al cliente: un turno cancelado,
// completado o no_show nunca recibe confirmación ni recordatorio. Con seña,
// "pending_payment" recibe la confirmación (aclarando que falta el pago) y
// recién recibe el recordatorio cuando el dueño valida el pago (→ confirmed).
const CONFIRMATION_STATUSES = ["confirmed", "pending", "pending_payment"];
const REMINDER_STATUSES = ["confirmed", "pending"];

type AppointmentRow = {
  id: string;
  businessId: string;
  customerName: string;
  customerEmail: string | null;
  serviceName: string;
  date: string;
  startTime: string;
  notes: string | null;
  status: string;
  depositAmount: number | null;
  totalAmount: number | null;
};

function toEmailData(appointment: AppointmentRow, businessName: string): BookingEmailData {
  return {
    businessName,
    customerName: appointment.customerName,
    serviceName: appointment.serviceName,
    date: appointment.date,
    startTime: appointment.startTime,
    notes: appointment.notes,
    pendingPayment: appointment.status === "pending_payment",
    depositAmount: appointment.depositAmount,
    totalAmount: appointment.totalAmount,
  };
}

// Nunca lanza: un email que falla no debe romper la creación de un turno.
export async function sendBookingConfirmation(appointmentId: string): Promise<"sent" | "skipped" | "failed"> {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { business: { select: { name: true } } },
    });
    if (!appointment?.customerEmail) return "skipped";
    if (!CONFIRMATION_STATUSES.includes(appointment.status)) return "skipped";

    // El negocio sale del propio turno (dato de confianza), nunca de un parámetro.
    const settings = await getEmailSettings(appointment.businessId);
    if (!settings.bookingConfirmationEnabled) return "skipped";

    // Reclamo atómico: solo UNA llamada (reintento, doble request) pasa de
    // null a fecha; las demás ven count = 0 y no envían.
    const claim = await prisma.appointment.updateMany({
      where: { id: appointment.id, confirmationEmailSentAt: null },
      data: { confirmationEmailSentAt: new Date() },
    });
    if (claim.count === 0) return "skipped";

    const email = bookingConfirmationEmail(toEmailData(appointment, appointment.business.name));
    const result = await sendBusinessEmail({
      businessId: appointment.businessId,
      to: appointment.customerEmail,
      ...email,
      idempotencyKey: `booking-confirmation/${appointment.id}`,
    });

    if (!result.ok) {
      // Se libera el reclamo para que un reintento posterior pueda enviarlo.
      await prisma.appointment.updateMany({ where: { id: appointment.id }, data: { confirmationEmailSentAt: null } });
      console.error("[email] Falló la confirmación de reserva:", result.error);
      return "failed";
    }
    return "sent";
  } catch (error) {
    console.error("[email] Error enviando la confirmación de reserva:", error instanceof Error ? error.message : "desconocido");
    return "failed";
  }
}

// Barrido de recordatorios (lo invoca el cron cada pocos minutos). Un turno
// entra cuando ya pasó (inicio − anticipación) y todavía no empezó. Cubre solo
// hoy y mañana (hora Argentina): los turnos más lejanos no pueden estar dentro
// de una ventana de 30/60 minutos. Reprogramar limpia reminderEmailSentAt (ver
// rescheduleAppointment) y cancelar saca al turno por estado, así que no hay
// nada que "cancelar" en un proveedor externo.
export async function sendDueReminders(now: Date = new Date()): Promise<{ sent: number; failed: number }> {
  const businesses = await prisma.emailNotificationSettings.findMany({
    where: { reminderEnabled: true },
    select: { businessId: true, reminderLeadMinutes: true },
  });
  if (businesses.length === 0) return { sent: 0, failed: 0 };

  const leadByBusiness = new Map(businesses.map((b) => [b.businessId, b.reminderLeadMinutes]));
  const today = getLocalNow(now).date;

  const candidates = await prisma.appointment.findMany({
    where: {
      businessId: { in: [...leadByBusiness.keys()] },
      date: { in: [today, addDays(today, 1)] },
      status: { in: REMINDER_STATUSES },
      customerEmail: { not: null },
      reminderEmailSentAt: null,
    },
    include: { business: { select: { name: true } } },
  });

  let sent = 0;
  let failed = 0;

  for (const appointment of candidates) {
    const lead = leadByBusiness.get(appointment.businessId) ?? EMAIL_SETTINGS_DEFAULTS.reminderLeadMinutes;
    const start = appointmentStart(appointment.date, appointment.startTime);
    const sendFrom = new Date(start.getTime() - lead * 60_000);
    if (now < sendFrom || now >= start) continue;

    const claim = await prisma.appointment.updateMany({
      where: { id: appointment.id, reminderEmailSentAt: null },
      data: { reminderEmailSentAt: now },
    });
    if (claim.count === 0) continue;

    const email = appointmentReminderEmail(toEmailData(appointment, appointment.business.name), lead);
    const result = await sendBusinessEmail({
      businessId: appointment.businessId,
      to: appointment.customerEmail!,
      ...email,
      // Incluye el horario: si el turno se reprograma, el nuevo recordatorio es
      // un email distinto para el proveedor.
      idempotencyKey: `appointment-reminder/${appointment.id}/${appointment.date}T${appointment.startTime}`,
    });

    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      await prisma.appointment.updateMany({ where: { id: appointment.id }, data: { reminderEmailSentAt: null } });
      console.error("[email] Falló el recordatorio de turno:", result.error);
    }
  }

  return { sent, failed };
}
