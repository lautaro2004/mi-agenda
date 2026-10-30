import { describe, expect, it } from "vitest";

import { detectConversationIntent } from "./detect";

const detect = (message: string, extra: Partial<Parameters<typeof detectConversationIntent>[0]> = {}) =>
  detectConversationIntent({ message, ...extra });

describe("detectConversationIntent", () => {
  it("1. «Quiero reservar un corte mañana» → booking", () => {
    expect(detect("Quiero reservar un corte mañana").intent).toBe("booking");
  });

  it("2. «Quiero un presupuesto para una página web» → proposal_request", () => {
    expect(detect("Quiero un presupuesto para una página web").intent).toBe("proposal_request");
  });

  it("3. «Mandame una propuesta por email» → proposal_request", () => {
    expect(detect("Mandame una propuesta por email").intent).toBe("proposal_request");
  });

  it("3b. «un mail con una propuesta» (el caso real) → proposal_request, también dentro de una reserva", () => {
    expect(detect("un mail con una propuesta").intent).toBe("proposal_request");
    expect(detect("un mail con una propuesta", { flowState: "COLLECTING_INTENT" }).intent).toBe("proposal_request");
    expect(detect("no, un mail dije", { flowState: "WAITING_CONFIRMATION" }).intent).toBe("proposal_request");
  });

  it("4. «¿Cuánto cuesta el servicio?» → general_inquiry", () => {
    const r = detect("¿Cuánto cuesta el servicio?");
    expect(r.intent).toBe("general_inquiry");
    expect(r.topic).toBe("pricing");
  });

  it("5. «Quiero hablar con alguien» → human_handoff", () => {
    expect(detect("Quiero hablar con alguien").intent).toBe("human_handoff");
  });

  it("6. «Quiero reservar una reunión» → booking si hay servicio reservable; si no, no inicia reserva", () => {
    expect(detect("Quiero reservar una reunión", { hasBookableServices: true }).intent).toBe("booking");
    expect(detect("Quiero reservar una reunión", { hasBookableServices: false }).intent).toBe("general_inquiry");
  });

  it("7. «Mañana» sin intención previa de reserva → no inicia booking", () => {
    expect(detect("Mañana").intent).toBe("other");
    expect(detect("mañana a las 10").intent).toBe("other");
    expect(detect("Reunión inicial").intent).toBe("other");
  });

  it("8. cambia de reserva a presupuesto en medio del flujo", () => {
    expect(detect("mejor mandame un presupuesto", { flowState: "WAITING_SLOT_SELECTION" }).intent).toBe("proposal_request");
  });

  it("una afirmación responde a lo que el asistente ofreció", () => {
    const recent = [{ sender: "ai" as const, text: "¿Querés que te armemos una propuesta?" }];
    expect(detect("dale", { recentMessages: recent }).intent).toBe("proposal_request");
    const booking = [{ sender: "ai" as const, text: "¿Querés reservar un turno?" }];
    expect(detect("sí", { recentMessages: booking }).intent).toBe("booking");
    expect(detect("sí").intent).toBe("other");
  });

  it("pedir cancelar o mover un turno sigue siendo booking", () => {
    expect(detect("quiero cancelar mi turno", { hasBookableServices: false }).intent).toBe("booking");
  });

  it("«personalizada» no dispara atención humana", () => {
    expect(detect("quiero una propuesta personalizada").intent).toBe("proposal_request");
  });
});
