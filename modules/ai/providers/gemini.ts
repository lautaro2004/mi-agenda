import { GoogleGenerativeAI } from "@google/generative-ai";

import type { AIProvider } from "@/modules/ai/providers/base";
import type { BuiltPrompt } from "@/modules/ai/prompt/builder";
import { recordAiUsage, type AiUsageMeta } from "@/modules/ai/usage";

const MODEL_ID = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

const MAX_HISTORY_TURNS = 10;

interface ChatTurn {
  role: "user" | "model";
  text: string;
}

interface GeminiContent {
  role: string;
  parts: { text: string }[];
}

// Cada request a esta app reconstruye el contexto completo desde cero
// (BusinessContext, TrainingPlan, memoria, historial y mensaje actual): no
// existe una sesión de chat viva entre requests. Por eso el payload final
// para Gemini se arma acá, en un único lugar, en vez de dejar que cada
// llamador (gateway de WhatsApp, motor de entrenamiento, simulador) intente
// garantizar por su cuenta el contrato de Gemini con su propio recorte de
// historial — esa duplicación fue justamente la causa de que el error
// "First content should be with role 'user'" volviera a aparecer después de
// un primer parche puntual.
function buildContents(history: ChatTurn[], message: string): GeminiContent[] {
  const turns: ChatTurn[] = [...history.slice(-MAX_HISTORY_TURNS), { role: "user", text: message }];

  // El turno actual siempre es "user", así que turns nunca queda vacío acá:
  // esto también garantiza que el resultado nunca empiece ni termine mal.
  const firstUserIndex = turns.findIndex((t) => t.role === "user");
  const trimmed = turns.slice(firstUserIndex);

  const contents: GeminiContent[] = [];
  for (const turn of trimmed) {
    const last = contents[contents.length - 1];
    if (last && last.role === turn.role) {
      // Gemini tampoco acepta dos turnos seguidos del mismo role: se fusiona
      // el texto en el turno anterior en vez de descartar información.
      last.parts[0].text += `\n${turn.text}`;
    } else {
      contents.push({ role: turn.role, parts: [{ text: turn.text }] });
    }
  }

  return contents;
}

export class GeminiProvider implements AIProvider {
  readonly modelId = MODEL_ID;
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateResponse(
    message: string,
    history: Array<{ role: "user" | "model"; text: string }>,
    prompt: BuiltPrompt,
    meta?: AiUsageMeta
  ): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: prompt.systemInstruction,
    });

    try {
      // generateContent() en vez de startChat()+sendMessage(): startChat()
      // modela una sesión de chat con estado que vive en memoria entre
      // llamadas — acá se creaba una instancia nueva en cada request y se
      // usaba para un único sendMessage(), sin aprovechar nada de esa
      // estatalidad. generateContent() es el primitivo stateless correcto
      // para "mandar todo el contexto de una y listo".
      const result = await model.generateContent({ contents: buildContents(history, message) });
      const text = result.response.text().trim();

      if (meta) {
        const usage = result.response.usageMetadata;
        recordAiUsage(
          meta,
          MODEL_ID,
          { promptTokens: usage?.promptTokenCount ?? null, completionTokens: usage?.candidatesTokenCount ?? null },
          true
        );
      }

      return text;
    } catch (error) {
      if (meta) {
        recordAiUsage(
          meta,
          MODEL_ID,
          { promptTokens: null, completionTokens: null },
          false,
          error instanceof Error ? error.message : String(error)
        );
      }
      throw error;
    }
  }
}
