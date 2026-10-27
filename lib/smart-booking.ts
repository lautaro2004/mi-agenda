import { z } from "zod";

// ── Agenda inteligente: reglas del negocio y priorización de horarios ───────
// Módulo PURO (sin base de datos): recibe los horarios que el motor real de
// disponibilidad (modules/appointments/service.ts → getAvailableSlots) ya
// validó como libres, y decide cuáles ofrecer, en qué orden y si la reserva
// se confirma sola o espera aprobación. NUNCA agrega un horario que el motor
// real no haya devuelto: las reglas solo pueden restringir y ordenar, no
// habilitar lo que está ocupado o fuera de horario.
//
// Las reglas las define el dueño; los mensajes de los clientes nunca las
// modifican (el chat/WhatsApp solo las leen).

export const BOOKING_MODES = ["auto", "assisted", "manual"] as const;
export type BookingMode = (typeof BOOKING_MODES)[number];

export const BOOKING_MODE_LABEL: Record<BookingMode, string> = {
  auto: "Automático",
  assisted: "Asistido (recomendado)",
  manual: "Manual con aprobación",
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const timeRangeSchema = z
  .object({
    from: z.string().regex(TIME, "Hora inválida (HH:MM)."),
    to: z.string().regex(TIME, "Hora inválida (HH:MM)."),
  })
  .refine((r) => toMinutes(r.from) < toMinutes(r.to), { message: "El rango debe terminar después de empezar." });

export type TimeRange = z.infer<typeof timeRangeSchema>;

const ranges = z.array(timeRangeSchema).max(8, "Máximo 8 rangos.");

export const smartBookingRulesSchema = z.object({
  mode: z.enum(BOOKING_MODES),
  // Horarios que el negocio prefiere llenar primero.
  preferredRanges: ranges,
  // Priorizar horarios pegados a un turno ya reservado (agenda "de corrido").
  consecutivePriority: z.boolean(),
  // Si el cliente es flexible, proponer primero un horario preferido más temprano.
  earlyAlternatives: z.boolean(),
  // Margen (minutos) entre un servicio y el siguiente.
  bufferMinutes: z.coerce.number().int().min(0).max(120),
  // Espacios reservados para atención espontánea: no se ofrecen por chat/WhatsApp
  // (el dueño igual puede agendar ahí desde el dashboard).
  reservedRanges: ranges,
  // Excepciones: rangos que requieren aprobación del dueño...
  approvalRanges: ranges,
  // ...y/o todo lo que caiga fuera de los horarios preferidos.
  approvalOutsidePreferred: z.boolean(),
  // Una solicitud pendiente bloquea el horario hasta que el dueño responda. Si no
  // responde en estas horas, o si falta menos que el mínimo para el turno, se
  // cancela sola y el horario se libera.
  approvalTimeoutHours: z.coerce.number().int().min(1).max(168),
  approvalMinLeadHours: z.coerce.number().int().min(0).max(72),
});

export type SmartBookingRules = z.infer<typeof smartBookingRulesSchema>;

// Punto de partida recomendado: asistido, sin restricciones adicionales. Con
// estas reglas el comportamiento es el del motor real, sin cambios.
export const DEFAULT_SMART_BOOKING_RULES: SmartBookingRules = {
  mode: "assisted",
  preferredRanges: [],
  consecutivePriority: false,
  earlyAlternatives: false,
  bufferMinutes: 0,
  reservedRanges: [],
  approvalRanges: [],
  approvalOutsidePreferred: false,
  approvalTimeoutHours: 24,
  approvalMinLeadHours: 2,
};

/** Normaliza lo guardado (posiblemente viejo o incompleto) a reglas válidas. */
export function parseStoredRules(raw: unknown, mode?: string | null): SmartBookingRules {
  const candidate = { ...DEFAULT_SMART_BOOKING_RULES, ...(raw && typeof raw === "object" ? raw : {}), ...(mode ? { mode } : {}) };
  const parsed = smartBookingRulesSchema.safeParse(candidate);
  return parsed.success ? parsed.data : DEFAULT_SMART_BOOKING_RULES;
}

// ── Utilidades de hora ──────────────────────────────────────────────────────

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function inRange(minute: number, r: TimeRange): boolean {
  return minute >= toMinutes(r.from) && minute < toMinutes(r.to);
}

function overlapsRange(start: number, end: number, r: TimeRange): boolean {
  return start < toMinutes(r.to) && end > toMinutes(r.from);
}

// ── Clasificación de horarios ───────────────────────────────────────────────

export interface ExistingBooking {
  startTime: string;
  durationMinutes: number;
}

export type SlotStatus = "preferred" | "available" | "needs_approval";
export type BlockedReason = "reserved" | "buffer";

export interface ClassifiedSlot {
  time: string;
  status: SlotStatus;
  /** Pegado a un turno existente (sin huecos). */
  consecutive: boolean;
  score: number;
}

export interface BlockedSlot {
  time: string;
  reason: BlockedReason;
}

export interface SlotClassification {
  /** Ofrecibles, ordenados de mejor a peor. */
  offerable: ClassifiedSlot[];
  /** Descartados por las reglas del negocio (no por ocupación: esa ya la filtró el motor real). */
  blocked: BlockedSlot[];
}

export function classifySlots(input: {
  /** Horarios libres según el motor real de disponibilidad. */
  slots: string[];
  /** Turnos ya reservados ese día (para margen y horarios consecutivos). */
  existing: ExistingBooking[];
  durationMinutes: number;
  rules: SmartBookingRules;
}): SlotClassification {
  const { rules } = input;
  const duration = Math.max(1, input.durationMinutes);
  const bookings = input.existing.map((b) => {
    const start = toMinutes(b.startTime);
    return { start, end: start + Math.max(1, b.durationMinutes) };
  });

  const offerable: ClassifiedSlot[] = [];
  const blocked: BlockedSlot[] = [];

  for (const time of input.slots) {
    const start = toMinutes(time);
    const end = start + duration;

    if (rules.reservedRanges.some((r) => overlapsRange(start, end, r))) {
      blocked.push({ time, reason: "reserved" });
      continue;
    }
    // Con margen 0 no se agrega ninguna restricción: se respeta el motor real.
    if (rules.bufferMinutes > 0 && bookings.some((b) => start < b.end + rules.bufferMinutes && end > b.start - rules.bufferMinutes)) {
      blocked.push({ time, reason: "buffer" });
      continue;
    }

    const preferred = rules.preferredRanges.some((r) => inRange(start, r));
    const needsApproval =
      rules.approvalRanges.some((r) => inRange(start, r)) ||
      (rules.approvalOutsidePreferred && rules.preferredRanges.length > 0 && !preferred);
    const consecutive = bookings.some((b) => start === b.end + rules.bufferMinutes || end + rules.bufferMinutes === b.start);

    let score = 0;
    if (preferred) score += 50;
    if (rules.consecutivePriority && consecutive) score += 30;
    if (needsApproval) score -= 20;

    offerable.push({ time, status: needsApproval ? "needs_approval" : preferred ? "preferred" : "available", consecutive, score });
  }

  // Mejor puntaje primero; a igual puntaje, el más temprano.
  offerable.sort((a, b) => b.score - a.score || toMinutes(a.time) - toMinutes(b.time));
  return { offerable, blocked };
}

// ── Propuesta de alternativas (negociación con el cliente) ─────────────────

export interface CustomerConstraints {
  /** Hora pedida por el cliente (ej. "19:00"). */
  requestedTime?: string;
  /** "Salgo a las 18:30" → no antes de esa hora. */
  notBefore?: string;
  notAfter?: string;
  /** El cliente dijo que puede cambiar de horario. undefined = no se sabe. */
  flexible?: boolean;
}

export interface SlotProposal {
  /** Horarios a ofrecer, en orden; ya respetan las restricciones del cliente. */
  options: ClassifiedSlot[];
  /** El horario pedido está entre los ofrecibles. */
  requestedAvailable: boolean;
  /** El asistente debe preguntar primero si el cliente puede un horario mejor. */
  askFirst: boolean;
}

export function proposeSlots(
  classification: SlotClassification,
  constraints: CustomerConstraints,
  rules: SmartBookingRules,
  max = 3
): SlotProposal {
  const notBefore = constraints.notBefore ? toMinutes(constraints.notBefore) : null;
  const notAfter = constraints.notAfter ? toMinutes(constraints.notAfter) : null;
  // Las restricciones del cliente son duras: jamás se ofrece fuera de ellas.
  const candidates = classification.offerable.filter((s) => {
    const t = toMinutes(s.time);
    return (notBefore === null || t >= notBefore) && (notAfter === null || t <= notAfter);
  });

  if (!constraints.requestedTime) {
    return { options: candidates.slice(0, max), requestedAvailable: false, askFirst: false };
  }

  const requested = candidates.find((s) => s.time === constraints.requestedTime) ?? null;
  const requestedMinute = toMinutes(constraints.requestedTime);

  // "Si piden las 19:00, preguntale primero si puede 17:00 o 18:00": solo si el
  // negocio lo activó, el cliente no dijo que es inflexible, y existe un
  // horario preferido más temprano que el pedido.
  const earlierPreferred = candidates.filter((s) => s.status === "preferred" && toMinutes(s.time) < requestedMinute);
  const askFirst =
    rules.earlyAlternatives &&
    constraints.flexible !== false &&
    earlierPreferred.length > 0 &&
    requested?.status !== "preferred";

  const rest = candidates.filter((s) => s !== requested && !(askFirst && earlierPreferred.includes(s)));
  const ordered = askFirst
    ? [...earlierPreferred, ...(requested ? [requested] : []), ...rest]
    : [...(requested ? [requested] : []), ...rest];

  return { options: ordered.slice(0, max), requestedAvailable: requested !== null, askFirst };
}

// ── Vencimiento de solicitudes pendientes de aprobación ─────────────────────

const HOUR_MS = 3_600_000;
const MIN_REVIEW_WINDOW_MS = 15 * 60_000;

/**
 * Hasta cuándo se retiene el horario esperando al dueño: lo que venza primero
 * entre "X horas desde ahora" y "Y horas antes del turno". Si el turno es tan
 * próximo que ya no hay margen, el dueño igual tiene un mínimo de 15 minutos
 * para responder (nunca más allá del inicio del turno).
 */
export function computeApprovalExpiry(now: Date, appointmentStart: Date, rules: Pick<SmartBookingRules, "approvalTimeoutHours" | "approvalMinLeadHours">): Date {
  const byTimeout = now.getTime() + rules.approvalTimeoutHours * HOUR_MS;
  const byLead = appointmentStart.getTime() - rules.approvalMinLeadHours * HOUR_MS;
  const withFloor = Math.max(Math.min(byTimeout, byLead), now.getTime() + MIN_REVIEW_WINDOW_MS);
  return new Date(Math.min(withFloor, Math.max(appointmentStart.getTime(), now.getTime() + 60_000)));
}

// ── Decisión de reserva según el modo ───────────────────────────────────────

export type BookingDecision = "confirm" | "needs_approval";

/**
 * ¿Se confirma el turno o espera al dueño? Solo decide la política: la
 * disponibilidad real se vuelve a validar en el servidor al crear el turno.
 */
export function decideBooking(mode: BookingMode, slot: Pick<ClassifiedSlot, "status">): BookingDecision {
  if (mode === "manual") return "needs_approval";
  return slot.status === "needs_approval" ? "needs_approval" : "confirm";
}
