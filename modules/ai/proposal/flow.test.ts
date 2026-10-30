import { describe, expect, it } from "vitest";

import type { Conversation } from "@/lib/types";
import { classify } from "@/modules/ai/triage/classifier";
import { decideRoute, looksLikeQuestion } from "@/modules/ai/intent/route";
import { conversationRepository } from "@/modules/whatsapp/conversations/repository";

import { handleProposalFlow, startProposalFlow, type ProposalDeps } from "./flow";

let counter = 0;
function newConversation(contactName = "Lucas Maldonado", contactPhone = "+5491155551234"): Conversation {
  counter += 1;
  return conversationRepository.ensureConversation({ id: `${5491100000000 + counter}@s.whatsapp.net`, businessId: "biz-test", contactName, contactPhone });
}

function fakeDeps(result: Awaited<ReturnType<ProposalDeps["captureLead"]>> = { ok: true, inquiryId: "inq1", created: true, nodo: "skipped" as never }) {
  const calls: Parameters<ProposalDeps["captureLead"]>[0][] = [];
  const deps: ProposalDeps = {
    captureLead: async (input) => {
      calls.push(input);
      return result;
    },
  };
  return { deps, calls };
}

// Simula lo que hace el gateway: clasifica, decide el flujo y lo ejecuta.
async function say(id: { businessId: string; id: string }, text: string, deps: ProposalDeps) {
  const conv = conversationRepository.get(id.businessId, id.id)!;
  const c = classify(text, conv.flowState, conv.messages.slice(-6), { hasBookableServices: true });
  const route = decideRoute({ flowState: conv.flowState, intent: c.intent, isQuestion: looksLikeQuestion(text) });
  if (route === "proposal_start" || route === "proposal_switch") return { route, res: startProposalFlow(text, conv, { service: conv.bookingSession?.service ?? null }) };
  if (route === "proposal_continue") return { route, res: await handleProposalFlow(text, conv, deps) };
  return { route, res: null };
}

describe("flujo de solicitud de propuesta (de punta a punta)", () => {
  it("registra el lead SOLO tras confirmar, con datos completos y origen WhatsApp", async () => {
    const conv = newConversation();
    const ref = { businessId: conv.businessId, id: conv.id };
    const { deps, calls } = fakeDeps();

    let r = await say(ref, "Quiero un presupuesto para una página web", deps);
    expect(r.route).toBe("proposal_start");
    expect(r.res!.text).toMatch(/email/i);
    expect(calls).toHaveLength(0);

    r = await say(ref, "lucas@kodexa.ar", deps);
    expect(r.res!.text).toMatch(/opcional/i);
    r = await say(ref, "mi empresa se llama Resto Sol, presupuesto $600.000", deps);
    expect(r.res!.text).toMatch(/voy a registrar/i);
    expect(calls).toHaveLength(0); // todavía nada se guardó

    r = await say(ref, "sí", deps);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ channel: "whatsapp", conversationRef: conv.id, email: "lucas@kodexa.ar", name: "Lucas Maldonado" });
    expect(calls[0].need).toContain("página web");
    expect(calls[0].summary).toContain("Resto Sol");
    expect(r.res!.text).toMatch(/Todavía no se envió ninguna propuesta/);
    expect(conversationRepository.get(ref.businessId, ref.id)!.flowState).toBe("IDLE");
    expect(conversationRepository.get(ref.businessId, ref.id)!.proposalDraft).toBeUndefined();
  });

  it("el caso real: en medio de una reserva, «un mail con una propuesta» sale de la reserva y NO ofrece horarios", async () => {
    const conv = newConversation();
    const ref = { businessId: conv.businessId, id: conv.id };
    conversationRepository.setFlowState(ref.businessId, ref.id, "COLLECTING_INTENT");
    conversationRepository.setBookingSession(ref.businessId, ref.id, {
      step: "need_service", service: null, serviceId: null, preferredDate: null, preferredDateLabel: null, availableSlots: [], selectedSlot: null, action: "new",
    });
    const { deps } = fakeDeps();

    const r = await say(ref, "un mail con una propuesta", deps);
    expect(r.route).toBe("proposal_switch");
    expect(r.res!.text).not.toMatch(/\d{1,2}:\d{2}|horarios|turno/i);
    expect(conversationRepository.get(ref.businessId, ref.id)!.flowState).toBe("COLLECTING_PROPOSAL");
  });

  it("8. de una reserva con servicio elegido a presupuesto: conserva el servicio y no confirma nada", async () => {
    const conv = newConversation();
    const ref = { businessId: conv.businessId, id: conv.id };
    conversationRepository.setFlowState(ref.businessId, ref.id, "WAITING_SLOT_SELECTION");
    conversationRepository.setBookingSession(ref.businessId, ref.id, {
      step: "need_slot", service: "Landing Page", serviceId: "s1", preferredDate: "2026-11-02", preferredDateLabel: "mañana", availableSlots: ["10:00"], selectedSlot: null, action: "new",
    });
    const { deps, calls } = fakeDeps();

    const r = await say(ref, "mejor mandame un presupuesto por mail", deps);
    expect(r.route).toBe("proposal_switch");
    expect(conversationRepository.get(ref.businessId, ref.id)!.proposalDraft!.need).toBe("Landing Page");
    expect(r.res!.text).toMatch(/email/i); // pide lo que falta, no repite el servicio
    expect(calls).toHaveLength(0);
  });

  it("si el registro falla NO dice que quedó registrado y deriva a una persona", async () => {
    const conv = newConversation();
    const ref = { businessId: conv.businessId, id: conv.id };
    const { deps } = fakeDeps({ ok: false, reason: "error", message: "boom" });
    await say(ref, "quiero un presupuesto para una web, mi mail es a@b.com", deps);
    await say(ref, "listo", deps);
    const r = await say(ref, "sí", deps);
    expect(r.res!.text).toMatch(/NO quedó registrada/);
    expect(r.res!.escalateToHuman).toBe(true);
  });

  it("el cliente puede corregir un dato antes de confirmar", async () => {
    const conv = newConversation();
    const ref = { businessId: conv.businessId, id: conv.id };
    const { deps, calls } = fakeDeps();
    await say(ref, "quiero un presupuesto para una web, mi mail es mal@mail.com", deps);
    await say(ref, "listo", deps);
    const r = await say(ref, "no, mi mail es bien@mail.com", deps);
    expect(r.res!.text).toMatch(/bien@mail.com/);
    await say(ref, "sí", deps);
    expect(calls[0].email).toBe("bien@mail.com");
  });
});
