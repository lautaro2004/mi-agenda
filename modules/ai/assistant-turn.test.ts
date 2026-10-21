import { describe, expect, it, vi } from "vitest";

import { handoffOutcome, leadRegisteredOutcome, runAssistantTurn } from "./assistant-turn";
import type { StrategyContext } from "@/modules/employee/strategy/types";

const context = {
  business: { id: "biz_1", name: "Peluquería Sol" },
  services: [],
  faqs: [],
  schedule: [],
  employee: {
    name: "Sofi",
    role: "recepcionista",
    description: "",
    formality: "neutral",
    warmth: "balanced",
    emojiUsage: "none",
    responseLength: "medium",
    commercialLevel: "balanced",
    goals: [],
    restrictions: [],
    capabilities: [],
  },
  memory: [],
  trainingPlan: null,
  strategyId: "receptionist",
  emphasis: [],
} as unknown as StrategyContext;

function provider(replies: (string | Error)[]) {
  const calls: { system: string }[] = [];
  return {
    calls,
    modelId: "test",
    generateResponse: vi.fn(async (_m: string, _h: unknown, prompt: { systemInstruction: string }) => {
      calls.push({ system: prompt.systemInstruction });
      const next = replies.shift();
      if (next instanceof Error) throw next;
      return next ?? "";
    }),
  };
}

const base = {
  context,
  conversation: null,
  message: "Quiero un presupuesto",
  history: [],
  options: { actions: { registerLead: true, handoff: true } },
  meta: { businessId: "biz_1", operation: "simulator" as const },
};

describe("runAssistantTurn", () => {
  it("sin acción devuelve la respuesta tal cual y no ejecuta nada", async () => {
    const p = provider(["¿Qué servicio estás buscando?"]);
    const execute = vi.fn();
    const r = await runAssistantTurn({ ...base, provider: p, execute });
    expect(r).toEqual({ text: "¿Qué servicio estás buscando?", escalate: false });
    expect(execute).not.toHaveBeenCalled();
    expect(p.calls[0].system).toContain("[[REGISTRAR_INTERESADO]]");
    expect(p.calls[0].system).toContain("CÓMO CONVERSAR");
  });

  it("ejecuta el registro y redacta el mensaje final con el resultado real", async () => {
    const p = provider(['[[REGISTRAR_INTERESADO]] {"nombre":"Ana","necesidad":"Color"}', "Listo Ana, quedó registrada tu consulta."]);
    const execute = vi.fn(async () => leadRegisteredOutcome({ need: "Color", created: true }));
    const r = await runAssistantTurn({ ...base, provider: p, execute });
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ name: "register_lead" }));
    expect(r.text).toBe("Listo Ana, quedó registrada tu consulta.");
    expect(r.escalate).toBe(false);
    // La segunda llamada recibe el resultado y ya no ofrece acciones.
    expect(p.calls[1].system).toContain("RESULTADO DE LA ACCIÓN");
    expect(p.calls[1].system).not.toContain("[[REGISTRAR_INTERESADO]] {");
  });

  it("si la redacción final falla usa un texto fijo coherente con el resultado", async () => {
    const p = provider(['[[DERIVAR]] {"resumen":"Quiere hablar del precio mayorista"}', new Error("timeout")]);
    const r = await runAssistantTurn({ ...base, provider: p, execute: async (a) => handoffOutcome({ summary: a.data.resumen, registered: false }) });
    expect(r.escalate).toBe(true);
    expect(r.text).toContain("una persona del equipo");
    expect(r.text).not.toMatch(/24 horas|enseguida|avisé|notifiqué/i);
  });

  it("ignora una acción no habilitada y nunca muestra el marcador", async () => {
    const p = provider(['Te tomo los datos. [[REGISTRAR_INTERESADO]] {"nombre":"Ana"}']);
    const execute = vi.fn();
    const r = await runAssistantTurn({ ...base, options: { actions: { registerLead: false, handoff: true } }, provider: p, execute });
    expect(execute).not.toHaveBeenCalled();
    expect(r.text).toBe("Te tomo los datos.");
  });
});
