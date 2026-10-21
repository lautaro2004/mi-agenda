import type { AIProvider } from "@/modules/ai/providers/base";
import type { BuiltPrompt } from "@/modules/ai/prompt/builder";
import { recordAiUsage, type AiUsageMeta } from "@/modules/ai/usage";

// Proveedor Claude (Anthropic Messages API) vía fetch directo: sin SDK
// nuevo, el contrato es un único POST /v1/messages.
//
// Mismo criterio que GeminiProvider: cada request reconstruye el contexto
// completo (no hay sesión viva) y el payload se normaliza acá, en un único
// lugar — el historial empieza siempre con "user", no tiene dos turnos
// seguidos del mismo rol y termina con el mensaje actual.

const API_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "") + "/v1/messages";
const API_VERSION = "2023-06-01";
const MAX_HISTORY_TURNS = 10;
const TIMEOUT_MS = 45_000;

interface ChatTurn {
  role: "user" | "model";
  text: string;
}

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export function buildMessages(history: ChatTurn[], message: string): ClaudeMessage[] {
  const turns: ChatTurn[] = [...history.slice(-MAX_HISTORY_TURNS), { role: "user", text: message }];
  const trimmed = turns.slice(turns.findIndex((t) => t.role === "user"));

  const messages: ClaudeMessage[] = [];
  for (const turn of trimmed) {
    const role = turn.role === "model" ? "assistant" : "user";
    const text = turn.text.trim();
    if (!text) continue;
    const last = messages[messages.length - 1];
    if (last && last.role === role) last.content += `\n${text}`;
    else messages.push({ role, content: text });
  }
  return messages;
}

export class AnthropicError extends Error {
  constructor(
    message: string,
    public status: number,
    public type?: string
  ) {
    super(message);
    this.name = "AnthropicError";
  }
}

export class AnthropicProvider implements AIProvider {
  readonly modelId: string;

  constructor(
    private apiKey: string,
    model: string,
    private maxTokens: number
  ) {
    this.modelId = model;
  }

  async generateResponse(
    message: string,
    history: Array<{ role: "user" | "model"; text: string }>,
    prompt: BuiltPrompt,
    meta?: AiUsageMeta
  ): Promise<string> {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": API_VERSION,
        },
        body: JSON.stringify({
          model: this.modelId,
          max_tokens: this.maxTokens,
          system: prompt.systemInstruction,
          messages: buildMessages(history, message),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const body = (await res.json().catch(() => null)) as {
        content?: { type: string; text?: string }[];
        stop_reason?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
        error?: { type?: string; message?: string };
      } | null;

      if (!res.ok || !body) {
        // Nunca se loguea la API key ni el prompt: solo status y tipo de error.
        throw new AnthropicError(`Claude respondió ${res.status}: ${body?.error?.type ?? "error"}`, res.status, body?.error?.type);
      }

      const text = (body.content ?? [])
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text)
        .join("")
        .trim();
      if (body.stop_reason === "max_tokens") console.warn(`[ai/claude] respuesta cortada por max_tokens (${this.modelId})`);

      if (meta) {
        recordAiUsage(
          meta,
          this.modelId,
          { promptTokens: body.usage?.input_tokens ?? null, completionTokens: body.usage?.output_tokens ?? null },
          true
        );
      }
      return text;
    } catch (error) {
      if (meta) {
        recordAiUsage(meta, this.modelId, { promptTokens: null, completionTokens: null }, false, error instanceof Error ? error.message : String(error));
      }
      throw error;
    }
  }
}
