import type { WAMessage } from "baileys";

import type { BookingSession, Conversation } from "@/lib/types";
import { conversationRepository } from "@/modules/whatsapp/conversations/repository";
import { downloadIncomingMedia, getMessageMediaKind } from "@/modules/whatsapp/messages/media";
import {
  PaymentProofValidationError,
  assignProofToAppointment,
  findPendingPaymentAppointments,
  submitProofForAppointment,
  submitUnassignedProof,
} from "@/modules/payments/service";

const DEFAULT_SESSION: BookingSession = {
  step: "confirmed",
  service: null,
  serviceId: null,
  preferredDate: null,
  preferredDateLabel: null,
  availableSlots: [],
  selectedSlot: null,
};

function formatAppointmentOption(appointment: { serviceName: string; date: string; startTime: string }): string {
  const [y, m, d] = appointment.date.split("-").map(Number);
  const label = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" }).format(new Date(y, m - 1, d));
  return `${appointment.serviceName} el ${label} a las ${appointment.startTime}`;
}

// Intercepta comprobantes de pago ANTES del pipeline normal de IA (ver
// modules/whatsapp/connection/manager.ts) — processMessage() solo conoce
// texto, nunca recibió el binario de una imagen/documento (ver
// modules/whatsapp/messages/sync.ts, extractMessageText devolvía apenas un
// placeholder "[Imagen]"). Devuelve null cuando el mensaje no es un
// comprobante o no hay ningún turno pendiente de pago al que asociarlo — en
// ese caso el caller sigue con el flujo normal (chequeo estructural, nunca
// se inventa una relación por texto libre, ver sección 6 de la tarea). Un
// negocio que nunca activó señas jamás tiene turnos en pending_payment, así
// que para ese caso esta función siempre devuelve null y el comportamiento
// actual queda intacto (sección 13 de la tarea).
export async function handleIncomingPaymentMessage(params: {
  businessId: string;
  jid: string;
  rawMessage: WAMessage;
  conversation: Conversation;
}): Promise<{ text: string } | null> {
  const { businessId, jid, rawMessage, conversation } = params;
  const phone = conversation.contactPhone;

  const pendingSelection = conversation.bookingSession?.pendingProofSelection;
  if (pendingSelection) {
    const raw = (rawMessage.message?.conversation ?? rawMessage.message?.extendedTextMessage?.text ?? "").trim();
    const index = Number.parseInt(raw, 10);

    if (!Number.isNaN(index) && index >= 1 && index <= pendingSelection.appointmentIds.length) {
      const appointmentId = pendingSelection.appointmentIds[index - 1];
      const result = await assignProofToAppointment({ businessId, proofId: pendingSelection.proofId, appointmentId });

      const nextSession: BookingSession = { ...(conversation.bookingSession ?? DEFAULT_SESSION) };
      delete nextSession.pendingProofSelection;
      conversationRepository.setBookingSession(jid, nextSession);

      if ("error" in result) {
        return { text: "No pudimos asociar el comprobante con ese turno. Escribinos y lo resolvemos a mano." };
      }
      return {
        text: "¡Gracias! Dejamos el comprobante asociado a ese turno, pendiente de validación. En cuanto lo revisemos te confirmamos.",
      };
    }

    // No fue un número válido: puede ser texto ambiguo o incluso otra
    // imagen — en cualquier caso, no adivinamos, volvemos a preguntar.
    const options = pendingSelection.appointmentIds.map((_, i) => i + 1).join(", ");
    return { text: `No entendí a cuál turno corresponde. Respondé solo con el número: ${options}.` };
  }

  const mediaKind = getMessageMediaKind(rawMessage);
  if (!mediaKind) return null;

  const candidates = await findPendingPaymentAppointments(businessId, phone);
  if (candidates.length === 0) return null;

  const media = await downloadIncomingMedia(rawMessage);
  if (!media) {
    return { text: "No pudimos recibir el archivo que enviaste. ¿Podés reenviarlo?" };
  }

  const file = { bytes: media.buffer, mimeType: media.mimeType, fileName: media.fileName };

  try {
    if (candidates.length === 1) {
      const result = await submitProofForAppointment({ businessId, appointmentId: candidates[0].id, file });
      if ("error" in result) return null;
      return {
        text: "¡Recibimos tu comprobante! Queda pendiente de validación — en cuanto lo revisemos te avisamos por acá. Gracias 🙌",
      };
    }

    const proof = await submitUnassignedProof({ businessId, file });
    conversationRepository.setBookingSession(jid, {
      ...(conversation.bookingSession ?? DEFAULT_SESSION),
      pendingProofSelection: { proofId: proof.id, appointmentIds: candidates.map((c) => c.id) },
    });

    const options = candidates
      .map((c, i) => `${i + 1}) ${formatAppointmentOption(c)}`)
      .join("\n");
    return { text: `Recibimos tu comprobante. Tenés más de un turno pendiente de pago, ¿a cuál corresponde?\n${options}` };
  } catch (error) {
    if (error instanceof PaymentProofValidationError) {
      return { text: error.message };
    }
    console.error("[whatsapp/payments] Error procesando comprobante:", error);
    return { text: "No pudimos procesar el comprobante. ¿Podés reenviarlo?" };
  }
}
