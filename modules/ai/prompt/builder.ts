import type {
  BusinessSchedule,
  Conversation,
  EmployeeCommercialLevel,
  EmployeeEmojiUsage,
  EmployeeFormality,
  EmployeeResponseLength,
  EmployeeWarmth,
  WeekDay,
} from "@/lib/types";
import type { StrategyContext } from "@/modules/employee/strategy/types";

export interface BuiltPrompt {
  systemInstruction: string;
}

const FORMALITY_PHRASES: Record<EmployeeFormality, string> = {
  casual: "Usá un tono informal y relajado.",
  neutral: "Usá un tono profesional pero cercano.",
  formal: "Usá un tono formal y protocolar.",
};

const WARMTH_PHRASES: Record<EmployeeWarmth, string> = {
  reserved: "Mantené cierta distancia profesional, sin ser frío.",
  balanced: "Sé amable y cercano, sin excederte.",
  warm: "Sé muy cálido y cercano, como alguien de confianza.",
};

const EMOJI_PHRASES: Record<EmployeeEmojiUsage, string> = {
  none: "No uses emojis.",
  low: "Usá emojis con moderación, solo cuando aporten calidez.",
  medium: "Usá emojis con frecuencia moderada para darle vida a la conversación.",
  high: "Usá emojis generosamente en tus respuestas.",
};

const LENGTH_PHRASES: Record<EmployeeResponseLength, string> = {
  short: "Respondé lo más breve posible, en una sola oración.",
  medium: "Respondé en 2 a 3 oraciones como máximo.",
  long: "Podés dar respuestas más detalladas, de hasta 5 oraciones.",
};

const COMMERCIAL_PHRASES: Record<EmployeeCommercialLevel, string> = {
  low: "No promociones activamente servicios adicionales; respondé solo lo que te preguntan.",
  balanced: "Podés mencionar servicios relacionados cuando sea natural, sin presionar.",
  high: "Buscá activamente oportunidades para ofrecer servicios adicionales.",
};

const DAY_NAMES: Record<WeekDay, string> = {
  monday: "Lunes",
  tuesday: "Martes",
  wednesday: "Miércoles",
  thursday: "Jueves",
  friday: "Viernes",
  saturday: "Sábado",
  sunday: "Domingo",
};

function formatSchedule(schedule: BusinessSchedule): string {
  const enabled = schedule.filter((d) => d.enabled);
  if (!enabled.length) return "Horarios no configurados.";
  return enabled
    .map((d) => {
      let line = `${DAY_NAMES[d.day]}: ${d.openTime}–${d.closeTime}`;
      if (d.hasBreak) line += ` (descanso ${d.breakStart}–${d.breakEnd})`;
      return line;
    })
    .join(", ");
}

export function buildPrompt(
  context: StrategyContext,
  _conversation: Conversation | null,
  _message: string
): BuiltPrompt {
  const { business, services, faqs, schedule, employee, memory, emphasis } = context;
  const name = business.name || "este negocio";

  const serviceLines =
    services.length > 0
      ? services
          .map(
            (s) =>
              `- ${s.name}: $${s.price.toLocaleString("es-AR")} (${s.durationMinutes} min)${s.description ? `. ${s.description}` : ""}`
          )
          .join("\n")
      : "No hay servicios cargados.";

  const faqLines =
    faqs.length > 0
      ? faqs.map((f) => `P: ${f.question}\nR: ${f.answer}`).join("\n\n")
      : "Sin preguntas frecuentes.";

  const activeGoals = employee.goals.filter((g) => g.active);
  const goalLines = activeGoals.length > 0 ? activeGoals.map((g) => `- ${g.text}`).join("\n") : null;

  const activeRestrictions = employee.restrictions.filter((r) => r.active);
  const restrictionLines =
    activeRestrictions.length > 0 ? activeRestrictions.map((r) => `- ${r.text}`).join("\n") : null;

  const memoryLines =
    memory.length > 0
      ? memory.map((m) => `- [${m.category}] ${m.title}: ${m.content}`).join("\n")
      : null;

  const emphasisLines = emphasis.length > 0 ? `\n${emphasis.join("\n")}\n` : "";

  const systemInstruction = `Sos ${employee.name}, ${employee.role} de ${name}${business.category ? `, dedicado a ${business.category}` : ""}.
${employee.description ? `${employee.description}\n` : ""}
INFORMACIÓN DEL NEGOCIO:
${business.description ? `- Descripción: ${business.description}` : ""}
${business.address ? `- Dirección: ${business.address}` : ""}
${business.phone ? `- Teléfono: ${business.phone}` : ""}

SERVICIOS:
${serviceLines}

HORARIOS:
${formatSchedule(schedule)}

PREGUNTAS FRECUENTES:
${faqLines}
${memoryLines ? `\nMEMORIA DEL NEGOCIO:\n${memoryLines}\n` : ""}
PERSONALIDAD:
- ${FORMALITY_PHRASES[employee.formality]}
- ${WARMTH_PHRASES[employee.warmth]}
- ${EMOJI_PHRASES[employee.emojiUsage]}
- ${LENGTH_PHRASES[employee.responseLength]}
- ${COMMERCIAL_PHRASES[employee.commercialLevel]}
${goalLines ? `\nOBJETIVOS:\n${goalLines}\n` : ""}${restrictionLines ? `\nRESTRICCIONES DEL NEGOCIO:\n${restrictionLines}\n` : ""}${emphasisLines}
REGLAS ESTRICTAS:
- Respondé siempre en español rioplatense (vos, acá, plata, etc.)
- NUNCA inventes información que no esté arriba
- Si no podés responder con datos del negocio, decí exactamente: "No tengo esa información. Te voy a derivar con alguien de nuestro equipo para ayudarte."
- Texto plano, sin asteriscos ni formato markdown
- No digas que sos una IA salvo que te lo pregunten`.trim();

  return { systemInstruction };
}
