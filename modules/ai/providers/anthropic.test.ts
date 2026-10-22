import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { recordAiUsage } = vi.hoisted(() => ({ recordAiUsage: vi.fn() }));
vi.mock("@/modules/ai/usage", () => ({ recordAiUsage }));

import { AnthropicProvider, buildMessages } from "./anthropic";
import { activeProviderName, getAIProvider } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
beforeEach(() => recordAiUsage.mockReset());

describe("buildMessages", () => {
  it("empieza con user, mapea model→assistant, fusiona roles repetidos y termina con el mensaje actual", () => {
    const out = buildMessages(
      [
        { role: "model", text: "hola, ¿en qué te ayudo?" },
        { role: "user", text: "quiero un turno" },
        { role: "user", text: "para mañana" },
        { role: "model", text: "¿a qué hora?" },
      ],
      "a las 10"
    );
    expect(out).toEqual([
      { role: "user", content: "quiero un turno\npara mañana" },
      { role: "assistant", content: "¿a qué hora?" },
      { role: "user", content: "a las 10" },
    ]);
  });
  it("sin historial: un único mensaje de usuario", () => {
    expect(buildMessages([], "hola")).toEqual([{ role: "user", content: "hola" }]);
  });
});

describe("AnthropicProvider", () => {
  it("llama a /v1/messages con los headers correctos y registra el consumo", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ content: [{ type: "text", text: " Respuesta " }], stop_reason: "end_turn", usage: { input_tokens: 120, output_tokens: 30 } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const provider = new AnthropicProvider("sk-test", "claude-haiku-5-5", 1024);
    const text = await provider.generateResponse("hola", [], { systemInstruction: "Sos el empleado" } as never, { businessId: "b1", operation: "whatsapp_reply" });
    expect(text).toBe("Respuesta");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(JSON.parse(init.body as string)).toMatchObject({ model: "claude-haiku-5-5", max_tokens: 1024, system: "Sos el empleado", messages: [{ role: "user", content: "hola" }] });
    expect(recordAiUsage).toHaveBeenCalledWith({ businessId: "b1", operation: "whatsapp_reply" }, "claude-haiku-5-5", { promptTokens: 120, completionTokens: 30 }, true);
  });
  it("un error de la API se propaga y queda registrado como fallido (sin exponer la clave)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "x" } }), { status: 529 })));
    const provider = new AnthropicProvider("sk-secreta", "claude-haiku-5-5", 1024);
    await expect(provider.generateResponse("hola", [], { systemInstruction: "s" } as never, { businessId: "b1", operation: "simulator" })).rejects.toThrow(/529: overloaded_error/);
    const call = recordAiUsage.mock.calls[0];
    expect(call[3]).toBe(false);
    expect(String(call[4])).not.toContain("sk-secreta");
  });
});

describe("selección de proveedor", () => {
  it("Claude si hay ANTHROPIC_API_KEY; modelo capaz para entrenamiento y rápido para WhatsApp", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk");
    vi.stubEnv("GEMINI_API_KEY", "g");
    expect(activeProviderName()).toBe("claude");
    expect(getAIProvider("training_onboarding")?.modelId).toBe("claude-sonnet-5-5");
    expect(getAIProvider("whatsapp_reply")?.modelId).toBe("claude-haiku-5-5");
    vi.stubEnv("ANTHROPIC_MODEL", "claude-sonnet-5-5");
    expect(getAIProvider("whatsapp_reply")?.modelId).toBe("claude-sonnet-5-5");
  });
  it("respaldo a Gemini si no hay clave de Claude, o si se fuerza con AI_PROVIDER", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "g");
    expect(activeProviderName()).toBe("gemini");
    vi.stubEnv("ANTHROPIC_API_KEY", "sk");
    vi.stubEnv("AI_PROVIDER", "gemini");
    expect(activeProviderName()).toBe("gemini");
  });
  it("sin ninguna clave: null (el llamador escala a humano)", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    expect(getAIProvider("whatsapp_reply")).toBeNull();
  });
});
