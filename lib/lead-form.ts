import { z } from "zod";

// ── Formulario configurable de la plantilla de captación ───────────────────
// Cada negocio decide qué le pregunta a un interesado. Sin Prisma: lo usan el
// formulario público (cliente), el editor del dashboard (cliente) y la ruta
// pública (servidor), y los tres validan con el MISMO schema derivado de la
// configuración (buildLeadSubmissionSchema) — un campo obligatorio no se
// saltea mandando el POST a mano.
//
// Nombre y WhatsApp no son configurables: sin ellos no hay forma de
// contactar al lead (Consultas, Nodo y la calificación dependen del número).

export const FIELD_MODES = ["required", "optional", "hidden"] as const;
export type FieldMode = (typeof FIELD_MODES)[number];

export const STANDARD_LEAD_FIELDS = ["customerEmail", "companyName", "location", "message"] as const;
export type StandardLeadField = (typeof STANDARD_LEAD_FIELDS)[number];

export const MAX_CUSTOM_QUESTIONS = 5;
export const MAX_QUESTION_OPTIONS = 8;

const label = z.string().trim().min(2, "Etiqueta muy corta").max(60, "Etiqueta muy larga (máx. 60)");
const fieldConfig = z.object({ mode: z.enum(FIELD_MODES), label });

const customQuestion = z
  .object({
    // Estable entre ediciones: las respuestas se mandan por id, no por
    // posición (reordenar o borrar una pregunta no corre las demás).
    id: z.string().trim().min(1).max(40),
    label: z.string().trim().min(3, "Escribí la pregunta").max(100, "Pregunta muy larga (máx. 100)"),
    type: z.enum(["text", "select"]),
    options: z
      .array(z.string().trim().min(1, "Opción vacía").max(40, "Opción muy larga (máx. 40)"))
      .max(MAX_QUESTION_OPTIONS, `Máximo ${MAX_QUESTION_OPTIONS} opciones`)
      .default([]),
    required: z.boolean(),
  })
  .refine((q) => q.type !== "select" || q.options.length >= 2, {
    message: "Una pregunta con opciones necesita al menos 2",
    path: ["options"],
  });

export const leadFormConfigSchema = z.object({
  fields: z.object({
    customerEmail: fieldConfig,
    companyName: fieldConfig,
    location: fieldConfig,
    message: fieldConfig,
  }),
  custom: z
    .array(customQuestion)
    .max(MAX_CUSTOM_QUESTIONS, `Máximo ${MAX_CUSTOM_QUESTIONS} preguntas propias`)
    .default([]),
});

export type LeadFormConfig = z.infer<typeof leadFormConfigSchema>;
export type LeadCustomQuestion = LeadFormConfig["custom"][number];

// Comportamiento de siempre del formulario de captación (antes de que fuera
// configurable): sin fila guardada, el sitio usa exactamente esto.
export const DEFAULT_LEAD_FORM: LeadFormConfig = {
  fields: {
    customerEmail: { mode: "required", label: "Email" },
    companyName: { mode: "optional", label: "Nombre de tu negocio" },
    location: { mode: "optional", label: "Zona o localidad" },
    message: { mode: "required", label: "¿Qué necesitás?" },
  },
  custom: [],
};

export function resolveLeadFormConfig(saved: unknown): LeadFormConfig {
  const parsed = leadFormConfigSchema.safeParse(saved);
  return parsed.success ? parsed.data : DEFAULT_LEAD_FORM;
}

// ── Envío ─────────────────────────────────────────────────────────────────

function textByMode(mode: FieldMode, requiredSchema: z.ZodString, max: number) {
  if (mode === "required") return requiredSchema;
  // Opcional u oculto: se acepta vacío (un campo oculto nunca viene, pero si
  // alguien lo manda igual se ignora al armar la consulta — ver más abajo).
  return z.string().trim().max(max).optional().default("");
}

export function buildLeadSubmissionSchema(config: LeadFormConfig) {
  const { fields } = config;
  const email =
    fields.customerEmail.mode === "required"
      ? z.string().trim().email("Ingresá un email válido").max(200)
      : z.union([z.literal(""), z.string().trim().email("Ingresá un email válido").max(200)]).optional().default("");

  const answers = z.object(
    Object.fromEntries(
      config.custom.map((q) => {
        let schema: z.ZodTypeAny =
          q.type === "select"
            ? z.union([z.literal(""), z.enum(q.options as [string, ...string[]], { message: "Elegí una opción" })])
            : z.string().trim().max(300, "Respuesta muy larga (máx. 300)");
        if (q.required) {
          schema = schema.refine((v) => typeof v === "string" && v.trim().length > 0, {
            message: q.type === "select" ? "Elegí una opción" : "Completá este campo",
          });
        } else {
          schema = schema.optional().default("");
        }
        return [q.id, schema];
      })
    )
  );

  return z.object({
    customerName: z.string().trim().min(2, "Ingresá tu nombre").max(100),
    customerWhatsapp: z.string().trim().min(6, "Ingresá un WhatsApp válido").max(30),
    customerEmail: email,
    companyName: textByMode(fields.companyName.mode, z.string().trim().min(2, "Completá este campo").max(120), 120),
    location: textByMode(fields.location.mode, z.string().trim().min(2, "Completá este campo").max(120), 120),
    message: textByMode(
      fields.message.mode,
      z.string().trim().min(1, "Contanos qué necesitás").max(500, "Muy largo (máx. 500 caracteres)"),
      500
    ),
    // preprocess (no .default): en zod 4 un default se devuelve SIN
    // validar, así que un POST sin "answers" salteaba las preguntas
    // obligatorias. Así el objeto vacío también pasa por la validación.
    answers: z.preprocess((value) => value ?? {}, answers),
    website: z.string().max(200).optional(),
  });
}

export type LeadSubmission = z.infer<ReturnType<typeof buildLeadSubmissionSchema>>;

// Texto final de la consulta. Los datos extra no tienen columna propia en
// Inquiry: van como encabezado del mensaje para que el dueño los vea en
// Consultas, Nodo los reciba en la nota y la calificación con IA los lea.
// Usa las etiquetas del negocio ("Nombre de tu local: …"). Los campos
// ocultos se ignoran aunque vengan en el body.
export function composeLeadMessage(config: LeadFormConfig, submission: LeadSubmission): string {
  const lines: string[] = [];
  const { fields } = config;
  if (fields.companyName.mode !== "hidden" && submission.companyName) {
    lines.push(`${fields.companyName.label}: ${submission.companyName}`);
  }
  if (fields.location.mode !== "hidden" && submission.location) {
    lines.push(`${fields.location.label}: ${submission.location}`);
  }
  for (const q of config.custom) {
    const answer = (submission.answers as Record<string, string | undefined>)[q.id]?.trim();
    // "¿Ya vendés por apps?: Sí" queda raro: si la pregunta ya termina en
    // "?" o ":", no se agrega otro separador.
    if (answer) lines.push(`${q.label}${/[?:]$/.test(q.label) ? "" : ":"} ${answer}`);
  }

  const message = fields.message.mode !== "hidden" ? submission.message.trim() : "";
  if (lines.length === 0) return message || "(Sin mensaje)";
  return message ? `${lines.join("\n")}\n\n${message}` : lines.join("\n");
}

// Email a guardar: null si el campo está oculto o vino vacío.
export function submissionEmail(config: LeadFormConfig, submission: LeadSubmission): string | null {
  if (config.fields.customerEmail.mode === "hidden") return null;
  return submission.customerEmail || null;
}

export function newQuestionId(): string {
  return `q_${Math.random().toString(36).slice(2, 10)}`;
}
