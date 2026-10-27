import type { Business, BusinessSchedule, Service } from "@/lib/types";
import { isBookableService } from "@/lib/types";
import { createAppointment } from "@/modules/appointments/service";
import { computeDepositAmount } from "@/modules/business/deposit";
import { evaluateBooking } from "@/modules/smart-booking/booking";

// Reserva desde un canal público (sitio web, chat con IA). ÚNICO lugar donde se
// decide el estado de una reserva pública, para que la ruta /book y el chat
// apliquen exactamente lo mismo: servicio reservable, validación de reglas de
// agenda inteligente (si el plan la incluye), aprobación pendiente, seña y
// la barrera final contra reservas simultáneas (createAppointment).

export interface PublicBookingInput {
  businessId: string;
  business: Business;
  services: Service[];
  schedule: BusinessSchedule;
  serviceId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  date: string;
  startTime: string;
  notes?: string;
  resourceId?: string | null;
}

export type PublicBookingResult =
  | { ok: true; appointment: Awaited<ReturnType<typeof createAppointment>> extends infer R ? (R extends { appointment: infer A } ? A : never) : never; pendingApproval: boolean }
  | { ok: false; error: "service_unavailable" | "slot_unavailable" | "invalid_resource" };

export async function createPublicBooking(input: PublicBookingInput): Promise<PublicBookingResult> {
  const service = input.services.find((s) => s.id === input.serviceId);
  if (!service || !isBookableService(service)) return { ok: false, error: "service_unavailable" };

  const depositQuote = computeDepositAmount(input.business, service);

  // Agenda inteligente: el servidor revalida el horario contra las reglas del
  // negocio (reservados, márgenes) y decide si se confirma o espera aprobación.
  // Sin el plan, o sin reglas, devuelve "confirm" y nada cambia.
  const evaluation = await evaluateBooking({
    businessId: input.businessId,
    date: input.date,
    startTime: input.startTime,
    schedule: input.schedule,
    serviceId: service.id,
    durationMinutes: service.durationMinutes,
  });
  if (!evaluation.ok) return { ok: false, error: "slot_unavailable" };
  const pendingApproval = evaluation.decision === "needs_approval";

  const result = await createAppointment({
    businessId: input.businessId,
    businessName: input.business.name,
    serviceId: service.id,
    serviceName: service.name,
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    customerEmail: input.customerEmail || null,
    date: input.date,
    startTime: input.startTime,
    durationMinutes: service.durationMinutes,
    notes: input.notes,
    resourceId: input.resourceId,
    // Esperando aprobación: la seña (si hay) se pide recién cuando el dueño apruebe.
    status: pendingApproval ? "pending" : depositQuote ? "pending_payment" : "confirmed",
    approvalExpiresAt: pendingApproval ? evaluation.approvalExpiresAt : null,
    depositAmount: depositQuote?.depositAmount,
    totalAmount: depositQuote?.totalAmount,
    source: "customer",
  });

  if ("error" in result) {
    return { ok: false, error: result.error === "invalid_resource" ? "invalid_resource" : "slot_unavailable" };
  }
  return { ok: true, appointment: result.appointment, pendingApproval };
}
