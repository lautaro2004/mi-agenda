import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SMART_BOOKING_RULES } from "@/lib/smart-booking";
import { applyProposal, describeChanges, extractJson, interpretInstruction } from "./interpret";

describe("interpretación de instrucciones", () => {
  it("extrae JSON aunque el modelo agregue texto", () => {
    expect(extractJson('Claro:\n```json\n{"bufferMinutes":10}\n```')).toEqual({ bufferMinutes: 10 });
    expect(extractJson("sin json")).toBeNull();
  });

  it("mezcla la propuesta sobre las reglas actuales", () => {
    const r = applyProposal(DEFAULT_SMART_BOOKING_RULES, { preferredRanges: [{ from: "17:00", to: "21:00" }], bufferMinutes: 10 });
    expect(r?.preferredRanges).toHaveLength(1);
    expect(r?.mode).toBe("assisted");
  });

  it("rechaza propuestas inválidas (rango al revés, margen fuera de límite, claves raras no rompen)", () => {
    expect(applyProposal(DEFAULT_SMART_BOOKING_RULES, { preferredRanges: [{ from: "21:00", to: "17:00" }] })).toBeNull();
    expect(applyProposal(DEFAULT_SMART_BOOKING_RULES, { bufferMinutes: 999 })).toBeNull();
    expect(applyProposal(DEFAULT_SMART_BOOKING_RULES, [])).toBeNull();
    expect(applyProposal(DEFAULT_SMART_BOOKING_RULES, { mode: "hackeado" })).toBeNull();
  });

  it("describe los cambios en lenguaje claro", () => {
    const after = applyProposal(DEFAULT_SMART_BOOKING_RULES, { reservedRanges: [{ from: "12:00", to: "14:00" }], mode: "manual" })!;
    const changes = describeChanges(DEFAULT_SMART_BOOKING_RULES, after);
    expect(changes.join("|")).toContain("12:00 a 14:00");
    expect(changes.join("|")).toContain("Manual");
  });

  it("no guarda nada: devuelve propuesta o razón", async () => {
    const provider = (text: string) => ({ modelId: "m", generateResponse: vi.fn().mockResolvedValue(text) });
    const ok = await interpretInstruction({ provider: provider('{"bufferMinutes":15}'), businessId: "b", instruction: "margen de 15", current: DEFAULT_SMART_BOOKING_RULES });
    expect(ok).toMatchObject({ ok: true });
    const none = await interpretInstruction({ provider: provider("{}"), businessId: "b", instruction: "hola", current: DEFAULT_SMART_BOOKING_RULES });
    expect(none).toEqual({ ok: false, reason: "no_changes" });
    const bad = await interpretInstruction({ provider: provider("no sé"), businessId: "b", instruction: "x", current: DEFAULT_SMART_BOOKING_RULES });
    expect(bad).toEqual({ ok: false, reason: "invalid" });
  });
});
