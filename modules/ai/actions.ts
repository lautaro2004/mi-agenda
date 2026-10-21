// Acciones reales que el asistente puede pedir durante una conversación.
//
// Protocolo independiente del proveedor (Claude o Gemini): cuando el modelo
// quiere ejecutar una acción, responde SOLO con un marcador y un JSON
//   [[REGISTRAR_INTERESADO]] {"nombre": "...", "necesidad": "...", ...}
//   [[DERIVAR]] {"resumen": "...", "necesidad": "..."}
// El servidor ejecuta la acción de verdad y vuelve a llamar al modelo con el
// RESULTADO real para que escriba el mensaje final. Así el cliente nunca lee
// "tus datos quedaron registrados" si el registro no se hizo.

export type AssistantActionName = "register_lead" | "handoff";

export interface AssistantAction {
  name: AssistantActionName;
  data: {
    nombre?: string;
    necesidad?: string;
    resumen?: string;
    email?: string;
    motivo?: string;
  };
}

const MARKERS: Record<string, AssistantActionName> = {
  REGISTRAR_INTERESADO: "register_lead",
  DERIVAR: "handoff",
};

const MARKER_RE = /\[\[\s*(REGISTRAR_INTERESADO|DERIVAR)\s*\]\]/;
const ANY_MARKER_RE = /\[\[\s*[A-Z_]+\s*\]\]\s*(\{[\s\S]*?\})?/g;

function readJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  if (start === -1) return {};
  // Toma el primer objeto JSON balanceado después del marcador.
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) {
      try {
        const parsed = JSON.parse(text.slice(start, i + 1));
        return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
      } catch {
        return {};
      }
    }
  }
  return {};
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

/** Detecta un pedido de acción en la respuesta del modelo. */
export function parseAssistantAction(text: string): AssistantAction | null {
  const match = MARKER_RE.exec(text);
  if (!match) return null;
  const raw = readJsonObject(text.slice(match.index + match[0].length));
  return {
    name: MARKERS[match[1]],
    data: {
      nombre: str(raw.nombre, 100),
      necesidad: str(raw.necesidad, 300),
      resumen: str(raw.resumen, 1000),
      email: str(raw.email, 200),
      motivo: str(raw.motivo, 300),
    },
  };
}

/** Saca cualquier marcador (y su JSON) de un texto que va a ver el cliente. */
export function stripActionMarkers(text: string): string {
  return text.replace(ANY_MARKER_RE, "").replace(/\n{3,}/g, "\n\n").trim();
}
