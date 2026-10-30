import type { ConversationFlowState } from "@/lib/types";

// Intención conversacional de un mensaje de WhatsApp. Es DETERMINISTA y se
// evalúa con el contexto (estado del flujo y últimos mensajes), no solo con
// el último mensaje: el router (modules/ai/gateway.ts) decide con esto qué
// flujo corre, así una reserva nunca arranca "por defecto".

export type ConversationIntent = "booking" | "proposal_request" | "general_inquiry" | "human_handoff" | "other";
export type InquiryTopic = "pricing" | "schedule" | "location" | "service";

export interface IntentMessage {
  sender: "customer" | "ai" | "business";
  text: string;
}

export interface IntentInput {
  message: string;
  flowState?: ConversationFlowState;
  recentMessages?: IntentMessage[];
  // Hay al menos un servicio que se reserva por turno. Sin él, un pedido de
  // reserva no puede resolverse con el flujo de turnos (default: true).
  hasBookableServices?: boolean;
}

export interface IntentResult {
  intent: ConversationIntent;
  topic?: InquiryTopic;
  confidence: number;
  reason: string;
}

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Estados donde hay una reserva en curso (cualquier paso).
export const BOOKING_FLOW_STATES: ReadonlySet<ConversationFlowState> = new Set([
  "COLLECTING_INTENT",
  "OFFERING_SLOTS",
  "WAITING_SLOT_SELECTION",
  "WAITING_CONFIRMATION",
  "WAITING_PAYMENT_PROOF",
]);

export const PROPOSAL_FLOW_STATES: ReadonlySet<ConversationFlowState> = new Set([
  "COLLECTING_PROPOSAL",
  "WAITING_PROPOSAL_CONFIRMATION",
]);

const HUMAN_RE =
  /\bhablar (con|a)\b|\bquiero hablar\b|\bnecesito hablar\b|atencion humana|persona real|\bhumano\b|\bduen[oa]\b|\bencargad[oa]\b|alguien de(l)? (equipo|ustedes|la empresa)|\boperador\b|\basesor\b|\bjef[ea]\b|\bno quiero (hablar con )?(un )?(bot|robot)\b|\bcomunicar(me)? con (alguien|una persona)\b/;

// Pedir presupuesto / cotización / propuesta comercial.
const PROPOSAL_NOUN_RE = /\b(presupuesto|presupuestos|cotizacion|cotizaciones|cotizar|propuesta|propuestas|proforma|oferta comercial)\b/;
const SEND_BY_CHANNEL_RE =
  /\b(mandame|mandanos|mandenme|enviame|enviamelo|pasame|pasamelo|me (lo |la |las )?(manda|mandan|envia|envian|pasa|pasan))\b.{0,40}\b(mail|email|e-mail|correo|propuesta|presupuesto|cotizacion|informacion|info|detalle)\b/;
const CHANNEL_RE = /\b(mail|e-?mail|correo)\b/;

const BOOKING_NOUN_RE = /\b(reservar|reserva|reservas|reservame|turno|turnos|cita|citas|agendar|agendame|agenda)\b/;
const MEETING_RE =
  /\b(quiero|queria|quisiera|necesito|puedo|podemos|podria|podriamos|me gustaria|coordinar|armar|pedir|tener|hacer|agendar|programar|solicitar)\b.{0,30}\b(reunion|llamada|videollamada|consulta|visita)\b/;
const AVAILABILITY_RE = /\b(horarios? disponibles?|turnos? disponibles?|disponibilidad|tienen lugar|hay lugar|hay turno)\b/;
const MODIFY_BOOKING_RE = /\b(cancelar|cancelo|cambiar|mover|reprogramar|reagendar|modificar|postergar)\b.{0,15}\b(turno|cita|reserva)\b/;

const PRICING_RE = /\bprecios?\b|\bcuesta(n)?\b|\bcuanto (sale|salen|cuesta|cuestan|cobran|cobra|vale|valen)\b|\btarifas?\b|\bvalor(es)?\b|\bcostos?\b|\bgratis\b/;
const SCHEDULE_RE = /\bhorarios?\b|\ba que hora\b|\b(abren|cierran|atienden|abre|cierra)\b|\bestan abiertos\b|\bdias de atencion\b|\bfin de semana\b|\babierto\b|\btrabajan\b/;
const LOCATION_RE = /\bdonde (estan|queda|quedan|es|se encuentra|los encuentro)\b|\bdireccion\b|\bubicacion\b|\bcomo llego\b|\bdomicilio\b/;
const SERVICE_RE = /\bque (servicios|hacen|ofrecen|realizan|tipos? de servicios?)\b|\bservicios?\b|\btratamientos?\b|\bque hac(en|es)\b/;
const QUESTION_RE = /\?|^(que|como|cuando|cuanto|cuanta|donde|cual|cuales|quien|por que|tienen|hacen|puedo|se puede|podes|podrian)\b/;

const AFFIRMATIVE_RE = /^(si|sii+|dale|ok|okay|claro|por favor|bueno|joya|perfecto|me gustaria|quiero|obvio|de una|genial)\b/;
const OFFER_PROPOSAL_RE = /(propuesta|presupuesto|cotizacion)/;
const OFFER_BOOKING_RE = /(reservar|agendar|sacar (un )?turno|coordinar (una )?(reunion|cita|llamada)|turno)/;

function lastAssistantText(recent: IntentMessage[] | undefined): string {
  const last = [...(recent ?? [])].reverse().find((m) => m.sender === "ai" || m.sender === "business");
  return last ? normalizeText(last.text) : "";
}

function topicOf(text: string): InquiryTopic | undefined {
  if (PRICING_RE.test(text)) return "pricing";
  if (SCHEDULE_RE.test(text)) return "schedule";
  if (LOCATION_RE.test(text)) return "location";
  if (SERVICE_RE.test(text)) return "service";
  return undefined;
}

export function detectConversationIntent(input: IntentInput): IntentResult {
  const text = normalizeText(input.message);
  const state = input.flowState ?? "IDLE";
  const hasBookable = input.hasBookableServices ?? true;
  const inBooking = BOOKING_FLOW_STATES.has(state);
  const inProposal = PROPOSAL_FLOW_STATES.has(state);

  if (!text) return { intent: "other", confidence: 0, reason: "empty" };

  // 1. Atención humana: siempre gana.
  if (HUMAN_RE.test(text)) return { intent: "human_handoff", confidence: 0.9, reason: "human_request" };

  // 2. Presupuesto / propuesta (incluye "mandame … por mail").
  if (PROPOSAL_NOUN_RE.test(text) || SEND_BY_CHANNEL_RE.test(text)) {
    return { intent: "proposal_request", confidence: 0.9, reason: "proposal_request" };
  }

  // 3. Reserva explícita.
  const explicitBooking = BOOKING_NOUN_RE.test(text) || MEETING_RE.test(text) || AVAILABILITY_RE.test(text) || MODIFY_BOOKING_RE.test(text);
  if (explicitBooking) {
    // Cancelar/mover un turno existente se resuelve con el flujo de turnos
    // aunque el negocio ya no tenga servicios reservables.
    if (!hasBookable && !MODIFY_BOOKING_RE.test(text)) {
      return { intent: "general_inquiry", confidence: 0.6, reason: "no_bookable_services" };
    }
    return { intent: "booking", confidence: 0.9, reason: "booking_request" };
  }

  // 4. Cambio de canal en medio de una reserva ("no, un mail dije").
  if (inBooking && CHANNEL_RE.test(text)) {
    return { intent: "proposal_request", confidence: 0.75, reason: "channel_switch_during_booking" };
  }

  // 5. Consulta general (precios, horarios, ubicación, servicios).
  const topic = topicOf(text);
  if (topic) return { intent: "general_inquiry", topic, confidence: 0.8, reason: `topic_${topic}` };

  // 6. Contexto: una afirmación responde a lo que el asistente ofreció.
  if (!inBooking && !inProposal && AFFIRMATIVE_RE.test(text)) {
    const offered = lastAssistantText(input.recentMessages);
    if (offered.includes("?")) {
      if (OFFER_PROPOSAL_RE.test(offered)) return { intent: "proposal_request", confidence: 0.7, reason: "accepted_proposal_offer" };
      if (hasBookable && OFFER_BOOKING_RE.test(offered)) return { intent: "booking", confidence: 0.7, reason: "accepted_booking_offer" };
    }
  }

  if (QUESTION_RE.test(text) && text.split(" ").length >= 3) {
    return { intent: "general_inquiry", confidence: 0.55, reason: "question" };
  }

  // Una fecha, una hora o un servicio suelto NO son intención de reservar.
  return { intent: "other", confidence: 0.3, reason: "no_signal" };
}
