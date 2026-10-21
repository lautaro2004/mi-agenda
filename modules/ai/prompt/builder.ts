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

// Opciones del turno (todas opcionales: sin ellas el prompt es el de antes,
// sin acciones). Ver modules/ai/actions.ts para el protocolo de acciones.
export interface PromptOptions {
  /** Acciones reales que el modelo puede pedir en este turno. */
  actions?: { registerLead: boolean; handoff: boolean };
  /** Datos del cliente que ya da el canal (WhatsApp). */
  customer?: { name?: string | null; phone?: string | null } | null;
  /** Interesado ya registrado para esta conversación. */
  openInquiry?: { need: string | null } | null;
  /** Resultado REAL de una acción ya ejecutada: el modelo escribe el mensaje final. */
  actionResult?: string;
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
  short: "Respondé lo más breve posible: una oración (más la pregunta para seguir, si corresponde).",
  medium: "Respondé en 2 a 3 oraciones como máximo.",
  long: "Podés dar respuestas más detalladas, de hasta 5 oraciones.",
};

const COMMERCIAL_PHRASES: Record<EmployeeCommercialLevel, string> = {
  low: "No ofrezcas servicios adicionales por iniciativa propia; enfocate en lo que te consultan.",
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

const CONVERSATION_RULES = `CÓMO CONVERSAR:
- Respondé primero lo que te preguntaron, con los datos del negocio.
- Si la conversación sigue abierta, terminá con UNA pregunta relevante o una invitación natural a seguir (para entender mejor qué necesita o para dar el próximo paso). No lo hagas si el cliente se está despidiendo, solo agradece o ya resolvió lo que buscaba.
- Antes de recomendar un servicio, plan o precio, entendé qué necesita: qué busca, cómo lo resuelve hoy o qué resultado espera. Preguntá de a una cosa. Si te pide un precio puntual, dáselo directo y después hacé la pregunta que te ayude a recomendarle mejor.
- Usá lo que el cliente ya te contó para personalizar la respuesta. No repitas preguntas que ya respondió ni insistas si no quiere avanzar.
- Tono cercano, profesional y comercial, sin presión. Evitá muletillas genéricas ("¡Excelente pregunta!", "Estoy para ayudarte", "No dudes en consultarme") y no repitas el mismo cierre en cada mensaje.`;

const HONESTY_RULES = `- Nunca digas que registraste sus datos, que avisaste o notificaste al equipo, que agendaste un seguimiento o que alguien lo va a contactar, salvo que el RESULTADO DE LA ACCIÓN lo confirme.
- No inventes plazos de respuesta (por ejemplo "en 24 horas" o "enseguida") salvo que figuren en la información del negocio.`;

function buildActionsSection(options: PromptOptions): string {
  if (options.actionResult) {
    return `\nRESULTADO DE LA ACCIÓN (real, informado por el sistema):
${options.actionResult}
Escribí ahora el mensaje para el cliente, coherente con este resultado y con lo que ya hablaron. No uses marcadores [[...]].\n`;
  }
  const actions = options.actions;
  if (!actions || (!actions.registerLead && !actions.handoff)) return "";

  const parts: string[] = [];
  if (actions.registerLead) {
    parts.push(`Registrar interesado: si el cliente muestra interés concreto en algo que ofrece el negocio (quiere contratar o comprar, pide presupuesto o que lo contacten) y ya sabés su nombre y qué necesita, registralo para que el equipo tenga su consulta. Si te falta el nombre o la necesidad, preguntalos primero de forma natural, de a uno. El teléfono ya lo tenemos por este chat: no lo pidas. El email es opcional. Para registrarlo respondé ÚNICAMENTE con esta línea, sin ningún otro texto:
[[REGISTRAR_INTERESADO]] {"nombre": "...", "necesidad": "qué necesita, en una línea", "resumen": "resumen breve de la conversación", "email": "solo si lo dio"}${
      options.openInquiry
        ? `\nEste cliente YA está registrado como interesado${options.openInquiry.need ? ` (necesidad: ${options.openInquiry.need})` : ""}. No lo vuelvas a registrar, salvo que cambie o amplíe lo que necesita.`
        : ""
    }`);
  }
  if (actions.handoff) {
    parts.push(`Derivar a una persona: cuando el cliente lo pida, cuando la consulta necesite información que no figura arriba, o ante un reclamo o algo que no podés resolver. Respondé ÚNICAMENTE con esta línea:
[[DERIVAR]] {"resumen": "qué entendiste de la consulta, en una o dos oraciones", "necesidad": "qué necesita, si quedó claro", "motivo": "por qué derivás"}`);
  }
  return `\nACCIONES (el sistema las ejecuta de verdad y te informa el resultado antes de que le respondas al cliente):
${parts.map((p) => `- ${p}`).join("\n")}\n`;
}

function buildCustomerSection(options: PromptOptions): string {
  const customer = options.customer;
  if (!customer?.name && !customer?.phone) return "";
  return `\nCLIENTE DE ESTE CHAT:
${customer.name ? `- Nombre de WhatsApp: ${customer.name} (si no parece un nombre real, preguntale cómo se llama antes de registrarlo)\n` : ""}${customer.phone ? "- Teléfono: ya lo tenemos por este chat\n" : ""}`;
}

export function buildPrompt(
  context: StrategyContext,
  _conversation: Conversation | null,
  _message: string,
  options: PromptOptions = {}
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

  // Solo informativo (ej. "¿piden seña?") — el flujo de reserva en sí lo
  // maneja el Booking Flow (modules/ai/booking/flow.ts), no este prompt. El
  // monto exacto no se repite acá porque depende del servicio (fijo vs. %
  // del precio), evitando que la IA invente un número desactualizado.
  const depositLines = business.depositRequired
    ? `\nSEÑA: Este negocio pide una seña para confirmar turnos. Si te preguntan, avisá que se pide seña y que se informa el monto y los datos para transferir al reservar. NUNCA digas "pago confirmado" ni des por confirmado un turno solo porque el cliente mandó una imagen o dijo que ya transfirió — la confirmación de un pago la hace únicamente el dueño del negocio desde su panel.\n`
    : "";

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
${depositLines}${memoryLines ? `\nMEMORIA DEL NEGOCIO:\n${memoryLines}\n` : ""}
PERSONALIDAD:
- ${FORMALITY_PHRASES[employee.formality]}
- ${WARMTH_PHRASES[employee.warmth]}
- ${EMOJI_PHRASES[employee.emojiUsage]}
- ${LENGTH_PHRASES[employee.responseLength]}
- ${COMMERCIAL_PHRASES[employee.commercialLevel]}
${goalLines ? `\nOBJETIVOS:\n${goalLines}\n` : ""}${restrictionLines ? `\nRESTRICCIONES DEL NEGOCIO:\n${restrictionLines}\n` : ""}${emphasisLines}
${CONVERSATION_RULES}
${buildCustomerSection(options)}${buildActionsSection(options)}
REGLAS ESTRICTAS:
- Respondé siempre en español rioplatense (vos, acá, plata, etc.)
- NUNCA inventes información que no esté arriba
${
    options.actionResult
      ? ""
      : options.actions?.handoff
        ? "- Si no podés responder con datos del negocio, usá la acción DERIVAR.\n"
        : '- Si no podés responder con datos del negocio, decí exactamente: "No tengo esa información. Te voy a derivar con alguien de nuestro equipo para ayudarte."\n'
  }${HONESTY_RULES}
- Texto plano, sin asteriscos ni formato markdown
- No digas que sos una IA salvo que te lo pregunten`.trim();

  return { systemInstruction };
}
