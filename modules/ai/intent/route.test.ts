import { describe, expect, it } from "vitest";

import { decideRoute, looksLikeQuestion } from "./route";

describe("decideRoute", () => {
  it("sin flujo activo, «mañana» o un dato suelto NO inicia una reserva", () => {
    expect(decideRoute({ flowState: "IDLE", intent: "other", isQuestion: false })).toBe("standard");
    expect(decideRoute({ flowState: "BOOKED", intent: "other", isQuestion: false })).toBe("standard");
  });

  it("solo el pedido explícito inicia cada flujo", () => {
    expect(decideRoute({ flowState: "IDLE", intent: "booking", isQuestion: false })).toBe("booking_start");
    expect(decideRoute({ flowState: "IDLE", intent: "proposal_request", isQuestion: false })).toBe("proposal_start");
    expect(decideRoute({ flowState: "IDLE", intent: "general_inquiry", isQuestion: true })).toBe("standard");
  });

  it("atención humana gana en cualquier estado", () => {
    for (const flowState of ["IDLE", "COLLECTING_INTENT", "WAITING_CONFIRMATION", "COLLECTING_PROPOSAL"] as const) {
      expect(decideRoute({ flowState, intent: "human_handoff", isQuestion: false })).toBe("human");
    }
  });

  it("de una reserva a una propuesta: sale del flujo de turnos (nunca sigue pidiendo horarios)", () => {
    for (const flowState of ["COLLECTING_INTENT", "OFFERING_SLOTS", "WAITING_SLOT_SELECTION", "WAITING_CONFIRMATION"] as const) {
      expect(decideRoute({ flowState, intent: "proposal_request", isQuestion: false })).toBe("proposal_switch");
    }
  });

  it("las respuestas del flujo (una hora, «sí») siguen en la reserva", () => {
    expect(decideRoute({ flowState: "WAITING_SLOT_SELECTION", intent: "other", isQuestion: false })).toBe("booking_continue");
    expect(decideRoute({ flowState: "WAITING_CONFIRMATION", intent: "other", isQuestion: false })).toBe("booking_continue");
  });

  it("una pregunta en medio de la reserva se responde sin perder el flujo", () => {
    expect(decideRoute({ flowState: "WAITING_SLOT_SELECTION", intent: "general_inquiry", isQuestion: true })).toBe("answer_keep");
  });

  it("con comprobante pendiente no se desvía", () => {
    expect(decideRoute({ flowState: "WAITING_PAYMENT_PROOF", intent: "proposal_request", isQuestion: false })).toBe("booking_continue");
  });

  it("de una propuesta a una reserva explícita cambia de flujo; lo demás sigue la propuesta", () => {
    expect(decideRoute({ flowState: "COLLECTING_PROPOSAL", intent: "booking", isQuestion: false })).toBe("booking_switch");
    expect(decideRoute({ flowState: "COLLECTING_PROPOSAL", intent: "other", isQuestion: false })).toBe("proposal_continue");
    expect(decideRoute({ flowState: "WAITING_PROPOSAL_CONFIRMATION", intent: "other", isQuestion: false })).toBe("proposal_continue");
    expect(decideRoute({ flowState: "COLLECTING_PROPOSAL", intent: "general_inquiry", isQuestion: true })).toBe("answer_keep");
  });

  it("describir el proyecto (aunque diga «precios») no es una pregunta", () => {
    expect(looksLikeQuestion("una web con precios y reservas")).toBe(false);
    expect(looksLikeQuestion("¿cuánto sale?")).toBe(true);
    expect(looksLikeQuestion("cuánto tardan")).toBe(true);
  });
});
