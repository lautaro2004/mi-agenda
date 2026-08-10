import type {
  BusinessSchedule,
  BusinessScheduleDay,
  Conversation,
  ConversationFlowState,
  Service,
  WeekDay,
} from "@/lib/types";
import type { AIResponse } from "@/modules/ai/types";
import type { BusinessContext } from "@/modules/ai/providers/base";
import { conversationRepository } from "@/modules/whatsapp/conversations/repository";
import { isBookableService } from "@/modules/business/service";

import type { BookingSession, BookingStep } from "./types";

// ── HELPERS ──────────────────────────────────────────────────────────────────

const ES_STOP_WORDS = new Set([
  "de", "el", "la", "los", "las", "en", "que", "y", "a", "es", "un", "una",
  "con", "para", "por", "no", "se", "lo", "te", "su", "al", "del", "me",
  "si", "mi", "tu", "o", "yo", "como", "más", "pero", "le", "ya", "muy",
  "hay", "fue", "ser", "son", "han", "tiene", "tienen", "puedo", "hola",
  "quiero", "necesito", "turno", "cita", "reservar", "sacar", "hacer",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !ES_STOP_WORDS.has(w));
}

function overlap(a: string[], b: string[]): number {
  const setB = new Set(b);
  return a.filter((w) => setB.has(w)).length;
}

function matchService(message: string, services: Service[]): Service | null {
  const tokens = tokenize(message);
  let best: { service: Service; score: number } | null = null;
  for (const s of services) {
    const st = tokenize(`${s.name} ${s.description} ${s.category}`);
    const score = overlap(tokens, st) + overlap(st, tokens);
    if (score > 0 && (!best || score > best.score)) best = { service: s, score };
  }
  return best?.service ?? null;
}

// ── DATE PARSING ─────────────────────────────────────────────────────────────

const JS_DAY_TO_WEEKDAY: Record<number, WeekDay> = {
  0: "sunday", 1: "monday", 2: "tuesday", 3: "wednesday",
  4: "thursday", 5: "friday", 6: "saturday",
};

const ES_DAY_TO_JS: Record<string, number> = {
  lunes: 1, martes: 2, miercoles: 3, miércoles: 3,
  jueves: 4, viernes: 5, sabado: 6, sábado: 6, domingo: 0,
};

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function nextOrSameWeekday(from: Date, targetDay: number): Date {
  const d = startOfDay(from);
  const diff = (targetDay - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
  return d;
}

const SPANISH_MONTHS: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
};

interface DateResult {
  date: Date;
  label: string;
  weekday: WeekDay;
}

export function parseUserDate(message: string): DateResult | null {
  const text = message.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const today = startOfDay(new Date());

  if (/\bhoy\b/.test(text)) {
    return { date: today, label: "hoy", weekday: JS_DAY_TO_WEEKDAY[today.getDay()] };
  }
  if (/\bmanana\b/.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return { date: d, label: "mañana", weekday: JS_DAY_TO_WEEKDAY[d.getDay()] };
  }
  if (/pasado\s+manana/.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 2);
    return { date: d, label: "pasado mañana", weekday: JS_DAY_TO_WEEKDAY[d.getDay()] };
  }

  for (const [name, jsDay] of Object.entries(ES_DAY_TO_JS)) {
    if (new RegExp(`\\b${name}\\b`).test(text)) {
      const d = nextOrSameWeekday(today, jsDay);
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      return { date: d, label: `el ${label}`, weekday: JS_DAY_TO_WEEKDAY[d.getDay()] };
    }
  }

  const explicitDate = text.match(/\b(\d{1,2})[\/\-\s](\d{1,2})\b/) ??
    text.match(/\b(\d{1,2})\s+de\s+(\w+)\b/);
  if (explicitDate) {
    const day = parseInt(explicitDate[1]);
    let month: number;
    if (/\d+/.test(explicitDate[2])) {
      month = parseInt(explicitDate[2]) - 1;
    } else {
      month = SPANISH_MONTHS[explicitDate[2]] ?? -1;
    }
    if (month >= 0 && day >= 1 && day <= 31) {
      const d = new Date(today.getFullYear(), month, day);
      if (d < today) d.setFullYear(d.getFullYear() + 1);
      const label = `el ${day}/${month + 1}`;
      return { date: d, label, weekday: JS_DAY_TO_WEEKDAY[d.getDay()] };
    }
  }

  return null;
}

// ── SLOT GENERATION ───────────────────────────────────────────────────────────

function parseTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function generateSlotsForDay(day: BusinessScheduleDay): string[] {
  const open = parseTime(day.openTime);
  const close = parseTime(day.closeTime);
  const breakStart = day.hasBreak ? parseTime(day.breakStart) : null;
  const breakEnd = day.hasBreak ? parseTime(day.breakEnd) : null;
  const slots: string[] = [];
  for (let t = open; t < close; t += 60) {
    if (breakStart !== null && breakEnd !== null && t >= breakStart && t < breakEnd) continue;
    slots.push(formatTime(t));
  }
  return slots;
}

export function getSlotsForDate(date: Date, schedule: BusinessSchedule): string[] {
  const weekday = JS_DAY_TO_WEEKDAY[date.getDay()];
  const day = schedule.find((d) => d.day === weekday && d.enabled);
  if (!day) return [];
  return generateSlotsForDay(day);
}

// ── SLOT SELECTION PARSING ────────────────────────────────────────────────────

export function parseSlotSelection(message: string, available: string[]): string | null {
  const text = message.toLowerCase().trim();

  if (/prim(ero|era)|primer/.test(text)) return available[0] ?? null;
  if (/[uú]ltim(o|a)/.test(text)) return available[available.length - 1] ?? null;
  if (/segund(o|a)/.test(text)) return available[1] ?? null;
  if (/tercer(o|a)?/.test(text)) return available[2] ?? null;

  const m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(hs|h|am|pm)?\b/);
  if (m) {
    const hour = parseInt(m[1]);
    const mins = parseInt(m[2] ?? "0");
    const candidate = `${String(hour).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    if (available.includes(candidate)) return candidate;
    const hourOnly = `${String(hour).padStart(2, "0")}:00`;
    if (available.includes(hourOnly)) return hourOnly;
  }

  return null;
}

// ── CANCEL / RESCHEDULE DETECTION ─────────────────────────────────────────────

const CANCEL_INTENT_RE =
  /\b(cancelar?|cancel[oa]r?|borrar?|eliminar?)\s+(mi\s+)?(turno|cita|reserva|turno)\b/i;
const RESCHEDULE_INTENT_RE =
  /\b(cambiar?|modificar?|mover?|reprogramar?|reagendar?|postergar?)\s+(mi\s+)?(turno|cita|reserva)\b/i;

// ── CONFIRM / DENY PATTERNS ───────────────────────────────────────────────────

const CONFIRM_RE =
  /^(si|sí|dale|ok|okay|confirmo|confirmado|listo|va|por supuesto|claro|exacto|sip|afirmativo|correcto)[\s!.]*$/i;
const DENY_RE =
  /^(no|cancelar|cancel|olvidá|olvidalo|no quiero|no gracias|cambio de idea)[\s!.]*$/i;

// ── RESPONSE BUILDERS ─────────────────────────────────────────────────────────

function bookingResponse(text: string, escalate = false): AIResponse {
  return {
    text,
    intent: "appointment",
    source: "rule",
    escalateToHuman: escalate,
    labelHint: escalate ? "human_required" : "appointment_request",
  };
}

function updateState(id: string, state: ConversationFlowState, session: BookingSession) {
  conversationRepository.setFlowState(id, state);
  conversationRepository.setBookingSession(id, session);
}

function clearFlow(id: string) {
  conversationRepository.setFlowState(id, "IDLE");
  conversationRepository.clearBookingSession(id);
}

// ── NEW BOOKING STEP HANDLERS ─────────────────────────────────────────────────

async function handleNeedService(
  message: string,
  session: BookingSession,
  conversationId: string,
  context: BusinessContext,
): Promise<AIResponse> {
  // Un servicio sin duración real (ej. "Landing Page" en una agencia web) no
  // es algo que se reserve como turno de calendario — ver isBookableService().
  // Ofrecerlo acá terminaría generando un turno de 0 minutos.
  const bookableServices = context.services.filter(isBookableService);

  if (!bookableServices.length) {
    clearFlow(conversationId);
    return bookingResponse(
      "No tengo servicios configurados para reservar por turno. Te voy a conectar con alguien de nuestro equipo.",
      true,
    );
  }

  const service = matchService(message, bookableServices);
  if (!service) {
    const list = bookableServices.map((s) => `• ${s.name}`).join("\n");
    updateState(conversationId, "COLLECTING_INTENT", { ...session, step: "need_service" });
    return bookingResponse(`Perfecto 😊 ¿Qué servicio querés reservar?\n\n${list}`);
  }

  const next: BookingSession = {
    ...session,
    service: service.name,
    serviceId: service.id,
    serviceDurationMinutes: service.durationMinutes,
    step: "need_date",
  };
  updateState(conversationId, "COLLECTING_INTENT", next);
  return bookingResponse(`Perfecto 😊 ¿Lo querés para hoy, mañana o algún día en particular?`);
}

async function handleNeedDate(
  message: string,
  session: BookingSession,
  conversationId: string,
  context: BusinessContext,
): Promise<AIResponse> {
  const parsed = parseUserDate(message);

  if (!parsed) {
    updateState(conversationId, "COLLECTING_INTENT", { ...session, step: "need_date" });
    return bookingResponse(`¿Para qué día lo querés? Podés decirme "hoy", "mañana" o el día de la semana.`);
  }

  // Lazy import to avoid circular dep at module load time
  const { getAvailableSlots } = await import("@/modules/appointments/service");
  const slots = await getAvailableSlots(context.business.id, parsed.date, context.schedule, session.serviceId);

  if (!slots.length) {
    updateState(conversationId, "COLLECTING_INTENT", { ...session, step: "need_date" });
    return bookingResponse(
      `No tenemos atención ${parsed.label}. ¿Preferís otro día? Podés decirme "hoy", "mañana" o un día de la semana.`,
    );
  }

  const next: BookingSession = {
    ...session,
    preferredDate: parsed.date.toISOString().split("T")[0],
    preferredDateLabel: parsed.label,
    availableSlots: slots,
    step: "need_slot",
  };
  updateState(conversationId, "WAITING_SLOT_SELECTION", next);

  const slotList = slots.join("\n");
  return bookingResponse(
    `Estos son los horarios disponibles para ${parsed.label}:\n\n${slotList}\n\n¿Cuál preferís?`,
  );
}

async function handleNeedSlot(
  message: string,
  session: BookingSession,
  conversationId: string,
): Promise<AIResponse> {
  const slot = parseSlotSelection(message, session.availableSlots);

  if (!slot) {
    const slotList = session.availableSlots.join("\n");
    updateState(conversationId, "WAITING_SLOT_SELECTION", { ...session, step: "need_slot" });
    return bookingResponse(
      `No pude entender tu selección. Los horarios disponibles son:\n\n${slotList}\n\n¿Cuál preferís? (Ejemplo: "10:00" o "el de las 10")`,
    );
  }

  const next: BookingSession = { ...session, selectedSlot: slot, step: "need_confirmation" };
  updateState(conversationId, "WAITING_CONFIRMATION", next);

  const dateLabel = session.preferredDateLabel ?? "el día seleccionado";
  const serviceName = session.service ?? "el servicio";
  return bookingResponse(
    `Perfecto.\n\n¿Confirmás tu turno para *${serviceName}* ${dateLabel} a las *${slot}*?`,
  );
}

async function handleNeedConfirmation(
  message: string,
  session: BookingSession,
  conversationId: string,
  conversation: Conversation,
  context: BusinessContext,
): Promise<AIResponse> {
  const text = message.trim();

  if (CONFIRM_RE.test(text)) {
    // Persist appointment
    try {
      const { createAppointment } = await import("@/modules/appointments/service");
      const result = await createAppointment({
        businessId: conversation.businessId,
        businessName: context.business.name,
        serviceId: session.serviceId,
        serviceName: session.service ?? "Servicio",
        customerName: conversation.contactName,
        customerPhone: conversation.contactPhone,
        date: session.preferredDate!,
        startTime: session.selectedSlot!,
        durationMinutes: session.serviceDurationMinutes ?? 60,
      });

      if ("error" in result) {
        clearFlow(conversationId);
        return bookingResponse(
          `Lo siento, ese horario ya fue tomado mientras coordinábamos. ¿Querés elegir otro? Escribí "quiero turno" para volver a empezar.`,
        );
      }
    } catch {
      // DB not available — still confirm to user (simulated booking)
    }

    const next: BookingSession = { ...session, step: "confirmed" };
    updateState(conversationId, "BOOKED", next);
    const dateLabel = session.preferredDateLabel ?? "el día seleccionado";
    const serviceName = session.service ?? "el servicio";
    const slot = session.selectedSlot ?? "";
    return bookingResponse(
      `¡Excelente 🎉 Tu turno quedó reservado para *${serviceName}* ${dateLabel} a las *${slot}*. ¡Te esperamos!`,
    );
  }

  if (DENY_RE.test(text)) {
    clearFlow(conversationId);
    return bookingResponse(`Sin problema. ¡Cuando quieras reagendar, avisame 😊`);
  }

  const dateLabel = session.preferredDateLabel ?? "el día seleccionado";
  const slot = session.selectedSlot ?? "";
  const serviceName = session.service ?? "el servicio";
  updateState(conversationId, "WAITING_CONFIRMATION", { ...session });
  return bookingResponse(
    `¿Confirmás el turno para *${serviceName}* ${dateLabel} a las *${slot}*? Respondé "sí" para confirmar o "no" para cancelar.`,
  );
}

// ── CANCEL FLOW ───────────────────────────────────────────────────────────────

async function startCancelFlow(
  conversationId: string,
  conversation: Conversation,
): Promise<AIResponse> {
  try {
    const { findByCustomerPhone } = await import("@/modules/appointments/service");
    const appointments = await findByCustomerPhone(conversation.businessId, conversation.contactPhone);

    if (!appointments.length) {
      clearFlow(conversationId);
      return bookingResponse(`No encontré turnos activos para tu número. ¿Podés verificar o escribirme de nuevo?`);
    }

    const appt = appointments[0];
    const session: BookingSession = {
      step: "cancel_confirm",
      action: "cancel",
      existingAppointmentId: appt.id,
      serviceDurationMinutes: appt.durationMinutes,
      service: appt.serviceName,
      serviceId: appt.serviceId,
      preferredDate: appt.date,
      preferredDateLabel: appt.date,
      availableSlots: [],
      selectedSlot: appt.startTime,
    };
    updateState(conversationId, "WAITING_CONFIRMATION", session);
    return bookingResponse(
      `Encontré tu turno:\n\n• *${appt.serviceName}* — ${appt.date} a las ${appt.startTime}\n\n¿Confirmás la cancelación? (sí / no)`,
    );
  } catch {
    clearFlow(conversationId);
    return bookingResponse(
      `No pude verificar tus turnos en este momento. Por favor comunicate con nosotros directamente.`,
      true,
    );
  }
}

async function handleCancelConfirm(
  message: string,
  session: BookingSession,
  conversationId: string,
): Promise<AIResponse> {
  if (CONFIRM_RE.test(message.trim())) {
    if (session.existingAppointmentId) {
      try {
        const { cancelAppointment } = await import("@/modules/appointments/service");
        await cancelAppointment(session.existingAppointmentId);
      } catch {
        // Proceed even if DB fails
      }
    }
    clearFlow(conversationId);
    return bookingResponse(`Tu turno fue cancelado. ¡Hasta pronto! Si querés reservar otro, avisame 😊`);
  }

  if (DENY_RE.test(message.trim())) {
    clearFlow(conversationId);
    return bookingResponse(`Cancelación descartada. ¡Tu turno sigue en pie! 😊`);
  }

  updateState(conversationId, "WAITING_CONFIRMATION", { ...session });
  return bookingResponse(
    `¿Confirmás la cancelación? Respondé "sí" para cancelar o "no" para mantener el turno.`,
  );
}

// ── RESCHEDULE FLOW ───────────────────────────────────────────────────────────

async function startRescheduleFlow(
  conversationId: string,
  conversation: Conversation,
): Promise<AIResponse> {
  try {
    const { findByCustomerPhone } = await import("@/modules/appointments/service");
    const appointments = await findByCustomerPhone(conversation.businessId, conversation.contactPhone);

    if (!appointments.length) {
      clearFlow(conversationId);
      return bookingResponse(`No encontré turnos activos para tu número. ¿Podés verificar o escribirme de nuevo?`);
    }

    const appt = appointments[0];
    const session: BookingSession = {
      step: "reschedule_date",
      action: "reschedule",
      existingAppointmentId: appt.id,
      serviceDurationMinutes: appt.durationMinutes,
      service: appt.serviceName,
      serviceId: appt.serviceId,
      preferredDate: null,
      preferredDateLabel: null,
      availableSlots: [],
      selectedSlot: null,
    };
    updateState(conversationId, "COLLECTING_INTENT", session);
    return bookingResponse(
      `Voy a reprogramar tu turno de *${appt.serviceName}* (actualmente ${appt.date} a las ${appt.startTime}).\n\n¿Para qué día lo querés mover?`,
    );
  } catch {
    clearFlow(conversationId);
    return bookingResponse(
      `No pude verificar tus turnos en este momento. Por favor comunicate con nosotros directamente.`,
      true,
    );
  }
}

async function handleRescheduleDate(
  message: string,
  session: BookingSession,
  conversationId: string,
  context: BusinessContext,
): Promise<AIResponse> {
  const parsed = parseUserDate(message);

  if (!parsed) {
    updateState(conversationId, "COLLECTING_INTENT", { ...session, step: "reschedule_date" });
    return bookingResponse(`¿Para qué día lo querés mover? Podés decirme "hoy", "mañana" o el día de la semana.`);
  }

  const { getAvailableSlots } = await import("@/modules/appointments/service");
  const slots = await getAvailableSlots(
    context.business.id,
    parsed.date,
    context.schedule,
    session.serviceId,
    session.existingAppointmentId,
  );

  if (!slots.length) {
    updateState(conversationId, "COLLECTING_INTENT", { ...session, step: "reschedule_date" });
    return bookingResponse(
      `No tenemos atención ${parsed.label}. ¿Preferís otro día?`,
    );
  }

  const next: BookingSession = {
    ...session,
    preferredDate: parsed.date.toISOString().split("T")[0],
    preferredDateLabel: parsed.label,
    availableSlots: slots,
    step: "reschedule_slot",
  };
  updateState(conversationId, "WAITING_SLOT_SELECTION", next);
  return bookingResponse(
    `Horarios disponibles para ${parsed.label}:\n\n${slots.join("\n")}\n\n¿Cuál preferís?`,
  );
}

async function handleRescheduleSlot(
  message: string,
  session: BookingSession,
  conversationId: string,
): Promise<AIResponse> {
  const slot = parseSlotSelection(message, session.availableSlots);

  if (!slot) {
    updateState(conversationId, "WAITING_SLOT_SELECTION", { ...session, step: "reschedule_slot" });
    return bookingResponse(
      `No pude entender tu selección. Los horarios disponibles son:\n\n${session.availableSlots.join("\n")}\n\n¿Cuál preferís?`,
    );
  }

  const next: BookingSession = { ...session, selectedSlot: slot, step: "reschedule_confirm" };
  updateState(conversationId, "WAITING_CONFIRMATION", next);
  return bookingResponse(
    `¿Confirmás mover tu turno de *${session.service}* para ${session.preferredDateLabel} a las *${slot}*?`,
  );
}

async function handleRescheduleConfirm(
  message: string,
  session: BookingSession,
  conversationId: string,
): Promise<AIResponse> {
  if (CONFIRM_RE.test(message.trim())) {
    if (!session.existingAppointmentId || !session.preferredDate || !session.selectedSlot) {
      clearFlow(conversationId);
      return bookingResponse(
        `Uy, no tengo claro qué turno querías mover. ¿Podés escribir "reprogramar turno" de nuevo?`,
      );
    }

    // No confiar en que "no tiró excepción" signifique éxito: rescheduleAppointment()
    // devuelve { error } explícito cuando el horario/recurso ya no está
    // disponible (revalidado server-side, mismo motor que usa el dashboard) —
    // nunca hay que confirmarle al cliente algo que en realidad se rechazó.
    // Un error de conexión real (no un {error} de negocio) sí se sigue
    // tolerando como en el resto del flujo de WhatsApp (handleNeedConfirmation
    // hace lo mismo): un hipo de infra no debería trabar la conversación.
    const { rescheduleAppointment } = await import("@/modules/appointments/service");
    let result: Awaited<ReturnType<typeof rescheduleAppointment>> | null = null;
    try {
      result = await rescheduleAppointment({
        id: session.existingAppointmentId,
        newDate: session.preferredDate,
        newStartTime: session.selectedSlot,
        durationMinutes: session.serviceDurationMinutes ?? 60,
      });
    } catch {
      // DB no disponible — se procede igual, como en handleNeedConfirmation.
    }

    if (result && "error" in result) {
      clearFlow(conversationId);
      return bookingResponse(
        `Lo siento, ese horario ya no está disponible. ¿Querés elegir otro? Escribí "reprogramar turno" para volver a empezar.`,
      );
    }

    updateState(conversationId, "BOOKED", { ...session, step: "confirmed" });
    return bookingResponse(
      `¡Listo! Tu turno quedó reprogramado para *${session.service}* ${session.preferredDateLabel} a las *${session.selectedSlot}*. ¡Te esperamos! 😊`,
    );
  }

  if (DENY_RE.test(message.trim())) {
    clearFlow(conversationId);
    return bookingResponse(`Sin problema, tu turno original sigue vigente 😊`);
  }

  updateState(conversationId, "WAITING_CONFIRMATION", { ...session });
  return bookingResponse(
    `¿Confirmás el cambio de turno para ${session.preferredDateLabel} a las ${session.selectedSlot}? Respondé "sí" o "no".`,
  );
}

// ── MAIN ENTRY ────────────────────────────────────────────────────────────────

function determineInitialStep(
  message: string,
  services: Service[],
): { step: BookingStep; service: Service | null } {
  const bookableServices = services.filter(isBookableService);
  if (!bookableServices.length) return { step: "need_service", service: null };
  const service = matchService(message, bookableServices);
  return { step: service ? "need_date" : "need_service", service };
}

export async function handleBookingFlow(
  message: string,
  conversation: Conversation,
  context: BusinessContext,
): Promise<AIResponse> {
  const id = conversation.id;

  // Detect cancel / reschedule intent before starting a new booking
  const isIdle = !conversation.bookingSession ||
    conversation.flowState === "IDLE" ||
    conversation.flowState === "BOOKED";

  if (isIdle) {
    if (CANCEL_INTENT_RE.test(message)) return startCancelFlow(id, conversation);
    if (RESCHEDULE_INTENT_RE.test(message)) return startRescheduleFlow(id, conversation);
  }

  let session = conversation.bookingSession;

  if (!session || conversation.flowState === "IDLE" || conversation.flowState === "BOOKED") {
    const { step, service } = determineInitialStep(message, context.services);
    session = {
      step,
      action: "new",
      service: service?.name ?? null,
      serviceId: service?.id ?? null,
      serviceDurationMinutes: service?.durationMinutes,
      preferredDate: null,
      preferredDateLabel: null,
      availableSlots: [],
      selectedSlot: null,
    };
  }

  switch (session.step) {
    case "need_service":
      return handleNeedService(message, session, id, context);

    case "need_date":
      return handleNeedDate(message, session, id, context);

    case "need_slot":
      return handleNeedSlot(message, session, id);

    case "need_confirmation":
      return handleNeedConfirmation(message, session, id, conversation, context);

    case "confirmed":
      clearFlow(id);
      return handleBookingFlow(message, { ...conversation, bookingSession: undefined, flowState: "IDLE" }, context);

    case "cancel_confirm":
      return handleCancelConfirm(message, session, id);

    case "reschedule_date":
      return handleRescheduleDate(message, session, id, context);

    case "reschedule_slot":
      return handleRescheduleSlot(message, session, id);

    case "reschedule_confirm":
      return handleRescheduleConfirm(message, session, id);
  }
}
