import { describe, expect, it } from "vitest";

import { AI_DISCLOSURE_TEXT, needsAiDisclosure, withAiDisclosure } from "./ai-disclosure";

const msg = (sender: "customer" | "business" | "ai") => ({
  id: Math.random().toString(),
  sender,
  text: "x",
  timestamp: new Date().toISOString(),
});

describe("aviso de IA en WhatsApp", () => {
  it("la primera respuesta automática lleva el aviso", () => {
    const conversation = { messages: [msg("customer")] };
    expect(needsAiDisclosure(conversation)).toBe(true);
    expect(withAiDisclosure(conversation, "Hola")).toBe(`${AI_DISCLOSURE_TEXT}\n\nHola`);
  });

  it("no se repite si la IA ya respondió en la conversación", () => {
    const conversation = { messages: [msg("customer"), msg("ai"), msg("customer")] };
    expect(withAiDisclosure(conversation, "Hola")).toBe("Hola");
  });

  it("un mensaje humano del negocio no cuenta como aviso previo", () => {
    expect(needsAiDisclosure({ messages: [msg("business")] })).toBe(true);
  });
});
