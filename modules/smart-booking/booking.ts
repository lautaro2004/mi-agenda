import { prisma } from "@/lib/prisma";
import type { BusinessSchedule } from "@/lib/types";
import {
  classifySlots,
  DEFAULT_SMART_BOOKING_RULES,
  proposeSlots,
  computeApprovalExpiry,
  decideBooking,
  toMinutes,
  type BookingDecision,
  type ClassifiedSlot,
  type CustomerConstraints,
  type SmartBookingRules,
} from "@/lib/smart-booking";
import { getAvailableSlots } from "@/modules/appointments/service";
import { canUseSmartBooking } from "@/modules/billing/subscription";
import { appointmentStart } from "@/modules/email/time";

import { getSmartBookingRules } from "./service";

// Une el motor real de disponibilidad (getAvailableSlots) con las reglas de la
// agenda inteligente. Es lo que usan los canales (sitio público hoy; chat web
// y WhatsApp después) para que TODOS apliquen las mismas reglas.
//
// Principios: (1) solo se aplica si el plan incluye la función — validado acá,
// en el servidor; (2) las reglas únicamente restan y ordenan: un horario que el
// motor real no devolvió nunca aparece; (3) quien crea el turno vuelve a
// validar (evaluateBooking) y createAppointment sigue siendo la barrera final
// contra reservas simultáneas.

const ACTIVE_STATUSES = ["pending", "confirmed", "pending_payment", "payment_submitted", "payment_rejected"];

/** Reglas vigentes, o null si el plan no incluye la agenda inteligente. */
export async function getActiveSmartRules(businessId: string): Promise<SmartBookingRules | null> {
  if (!(await canUseSmartBooking(businessId))) return null;
  return (await getSmartBookingRules(businessId)).rules;
}

interface DateInput {
  businessId: string;
  /** YYYY-MM-DD */
  date: string;
  schedule: BusinessSchedule;
  serviceId?: string | null;
  durationMinutes: number;
}

async function classifyDay(input: DateInput, rules: SmartBookingRules) {
  const base = await getAvailableSlots(input.businessId, new Date(`${input.date}T00:00:00`), input.schedule, input.serviceId);
  const existing = await prisma.appointment.findMany({
    where: { businessId: input.businessId, date: input.date, status: { in: ACTIVE_STATUSES } },
    select: { startTime: true, durationMinutes: true },
  });
  return classifySlots({ slots: base, existing, durationMinutes: input.durationMinutes, rules });
}

export interface SmartAvailability {
  /** Horarios ofrecibles en orden cronológico (compatible con el widget actual). */
  slots: string[];
  /** Cuáles son preferidos por el negocio. */
  preferred: string[];
  /** Cuáles quedarían pendientes de aprobación. */
  needsApproval: string[];
}

/** null = el plan no incluye la función: el caller usa el motor normal. */
export async function getSmartAvailability(input: DateInput): Promise<SmartAvailability | null> {
  const rules = await getActiveSmartRules(input.businessId);
  if (!rules) return null;

  const { offerable } = await classifyDay(input, rules);
  const byTime = [...offerable].sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  return {
    slots: byTime.map((s) => s.time),
    preferred: byTime.filter((s) => s.status === "preferred").map((s) => s.time),
    needsApproval: byTime.filter((s) => s.status === "needs_approval").map((s) => s.time),
  };
}

export type BookingEvaluation =
  | { ok: false; reason: "slot_unavailable" }
  | { ok: true; decision: BookingDecision; approvalExpiresAt: Date | null };

/**
 * Validación en el servidor antes de crear el turno: ¿el horario sigue siendo
 * ofrecible según las reglas? ¿Se confirma o espera aprobación? Sin plan o sin
 * reglas devuelve "confirm" y no cambia nada del comportamiento actual.
 */
export async function evaluateBooking(input: DateInput & { startTime: string; now?: Date }): Promise<BookingEvaluation> {
  const rules = await getActiveSmartRules(input.businessId);
  if (!rules) return { ok: true, decision: "confirm", approvalExpiresAt: null };

  const { offerable } = await classifyDay(input, rules);
  const slot = offerable.find((s) => s.time === input.startTime);
  if (!slot) return { ok: false, reason: "slot_unavailable" };

  const decision = decideBooking(rules.mode, slot);
  const now = input.now ?? new Date();
  return {
    ok: true,
    decision,
    approvalExpiresAt: decision === "needs_approval" ? computeApprovalExpiry(now, appointmentStart(input.date, input.startTime), rules) : null,
  };
}

export interface DayOptions {
  options: ClassifiedSlot[];
  requestedAvailable: boolean;
  /** Conviene preguntar primero si el cliente puede un horario preferido más temprano. */
  askFirst: boolean;
  /** Se aplicaron reglas de agenda inteligente (plan + reglas). */
  smart: boolean;
}

/**
 * Horarios a proponer en un canal conversacional (chat web). Con agenda
 * inteligente aplica las reglas del negocio; sin ella devuelve los horarios del
 * motor real en orden cronológico. Las restricciones del cliente (no antes de /
 * no después de) son siempre duras.
 */
export async function getDayOptions(input: DateInput & { constraints?: CustomerConstraints; max?: number }): Promise<DayOptions> {
  const rules = await getActiveSmartRules(input.businessId);
  const effective = rules ?? DEFAULT_SMART_BOOKING_RULES;
  const classification = await classifyDay(input, effective);
  const proposal = proposeSlots(classification, input.constraints ?? {}, effective, input.max ?? 3);
  return { ...proposal, smart: rules !== null };
}
