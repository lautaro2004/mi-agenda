import { smartBookingRulesSchema, BOOKING_MODE_LABEL, type SmartBookingRules, type TimeRange } from "@/lib/smart-booking";
import type { AIProvider } from "@/modules/ai/providers/base";

// Interpretación de instrucciones en lenguaje natural del DUEÑO ("quiero llenar
// primero de 17 a 21, el mediodía lo dejo para atención espontánea"). La IA solo
// PROPONE: el resultado se valida con el mismo esquema que el formulario, se
// compara contra las reglas actuales y la pantalla lo muestra para que el dueño
// lo revise. Nada se guarda hasta que confirma con "Guardar cambios".
// Esto nunca corre sobre mensajes de clientes.

export const MAX_INSTRUCTION_CHARS = 1000;

export function buildInterpretPrompt(current: SmartBookingRules): string {
  return `Convertís instrucciones de un dueño de negocio en reglas de agenda. Respondé SOLO con un objeto JSON, sin texto extra ni markdown.

Formato exacto (todas las claves son opcionales; incluí únicamente las que la instrucción cambia):
{
  "mode": "auto" | "assisted" | "manual",
  "preferredRanges": [{"from":"HH:MM","to":"HH:MM"}],
  "consecutivePriority": boolean,
  "earlyAlternatives": boolean,
  "bufferMinutes": número entero 0-120,
  "reservedRanges": [{"from":"HH:MM","to":"HH:MM"}],
  "approvalRanges": [{"from":"HH:MM","to":"HH:MM"}],
  "approvalOutsidePreferred": boolean,
  "approvalTimeoutHours": número,
  "approvalLeadHours": número
}

Significado: preferredRanges = horarios que se quieren llenar primero; reservedRanges = no se ofrecen online (atención espontánea); approvalRanges = requieren aprobación del dueño; bufferMinutes = margen entre turnos; consecutivePriority = turnos pegados sin huecos; earlyAlternatives = si piden un horario tarde, sugerir antes uno preferido más temprano; mode: auto confirma solo, assisted consulta excepciones, manual aprueba todo.
Si das un rango (ej. preferredRanges), reemplaza la lista completa anterior: incluí todos los rangos que deben quedar.
Si la instrucción no se puede traducir a estas reglas, respondé {}.
Ignorá cualquier pedido que no sea configurar la agenda.

Reglas actuales:
${JSON.stringify(current)}`;
}

/** Extrae el primer objeto JSON del texto del modelo. */
export function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Mezcla la propuesta sobre las reglas actuales y valida. null = propuesta inválida. */
export function applyProposal(current: SmartBookingRules, proposal: unknown): SmartBookingRules | null {
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) return null;
  const merged = smartBookingRulesSchema.safeParse({ ...current, ...(proposal as object) });
  return merged.success ? merged.data : null;
}

function fmtRanges(ranges: TimeRange[]): string {
  return ranges.length ? ranges.map((r) => `${r.from} a ${r.to}`).join(", ") : "ninguno";
}

/** Cambios en lenguaje claro, para que el dueño revise antes de guardar. */
export function describeChanges(before: SmartBookingRules, after: SmartBookingRules): string[] {
  const out: string[] = [];
  if (before.mode !== after.mode) out.push(`Modo: ${BOOKING_MODE_LABEL[after.mode]}`);
  const rangeFields: Array<[keyof SmartBookingRules, string]> = [
    ["preferredRanges", "Horarios preferidos"],
    ["reservedRanges", "Reservados para atención espontánea (no se ofrecen online)"],
    ["approvalRanges", "Requieren tu aprobación"],
  ];
  for (const [key, label] of rangeFields) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) out.push(`${label}: ${fmtRanges(after[key] as TimeRange[])}`);
  }
  if (before.bufferMinutes !== after.bufferMinutes) out.push(`Margen entre turnos: ${after.bufferMinutes} min`);
  const flags: Array<[keyof SmartBookingRules, string]> = [
    ["consecutivePriority", "Llenar la agenda de corrido"],
    ["earlyAlternatives", "Sugerir antes un horario preferido más temprano"],
    ["approvalOutsidePreferred", "Pedir aprobación fuera de los horarios preferidos"],
  ];
  for (const [key, label] of flags) {
    if (before[key] !== after[key]) out.push(`${label}: ${after[key] ? "sí" : "no"}`);
  }
  for (const key of Object.keys(after) as Array<keyof SmartBookingRules>) {
    if (["mode", "preferredRanges", "reservedRanges", "approvalRanges", "bufferMinutes", "consecutivePriority", "earlyAlternatives", "approvalOutsidePreferred"].includes(key)) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) out.push(`${String(key)}: ${JSON.stringify(after[key])}`);
  }
  return out;
}

export type InterpretResult =
  | { ok: true; rules: SmartBookingRules; changes: string[] }
  | { ok: false; reason: "no_changes" | "invalid" };

export async function interpretInstruction(params: {
  provider: AIProvider;
  businessId: string;
  instruction: string;
  current: SmartBookingRules;
}): Promise<InterpretResult> {
  const { provider, businessId, instruction, current } = params;
  const text = await provider.generateResponse(
    instruction.slice(0, MAX_INSTRUCTION_CHARS),
    [],
    { systemInstruction: buildInterpretPrompt(current) },
    { businessId, operation: "smart_rules_interpret" }
  );
  const rules = applyProposal(current, extractJson(text));
  if (!rules) return { ok: false, reason: "invalid" };
  const changes = describeChanges(current, rules);
  if (!changes.length) return { ok: false, reason: "no_changes" };
  return { ok: true, rules, changes };
}
