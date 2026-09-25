import { z } from "zod";
import { HEX_COLOR_RE } from "@/lib/brand-color";
import {
  AI_PROPOSABLE_SECTION_STATUSES,
  BUSINESS_CATEGORIES,
  EMPLOYEE_CAPABILITIES,
  EMPLOYEE_COMMERCIAL_LEVEL_LEVELS,
  EMPLOYEE_EMOJI_USAGE_LEVELS,
  EMPLOYEE_FORMALITY_LEVELS,
  EMPLOYEE_RESPONSE_LENGTH_LEVELS,
  EMPLOYEE_WARMTH_LEVELS,
  BILLING_SUBSCRIPTION_STATUSES,
  DEPOSIT_TYPES,
  SITE_TEMPLATES,
  MEMORY_CATEGORIES,
  MEMORY_IMPORTANCE_LEVELS,
  SERVICE_CATEGORIES,
  WEEK_DAYS,
  LEAD_GOALS,
  LEAD_MONTHLY_VOLUMES,
  LEAD_STATUSES,
  type EmployeeCapabilityKey,
} from "@/lib/types";

export const registerSchema = z
  .object({
    businessName: z.string().min(2, "Ingresá el nombre de tu negocio"),
    ownerName: z.string().min(2, "Ingresá tu nombre"),
    email: z.string().email("Ingresá un email válido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

// ── Perfil de usuario (/dashboard/cuenta) ────────────────────────────────
// Solo "name"/"image" — el User de better-auth (prisma/schema.prisma) no
// tiene un campo "lastName" separado, y el email es de solo lectura acá
// (changeEmail no está habilitado en lib/auth/auth.ts, ver auditoría).
export const profileSchema = z.object({
  name: z.string().min(2, "Ingresá tu nombre"),
  image: z.string().nullable(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

// Mismo mínimo de 8 caracteres que registerSchema — better-auth valida el
// mismo mínimo server-side por default, esto solo evita el viaje redondo
// para un error obvio.
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Ingresá tu contraseña actual"),
    newPassword: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    confirmNewPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmNewPassword"],
  });

export type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export const loginSchema = z.object({
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const businessInfoSchema = z.object({
  name: z.string().min(2, "Ingresá el nombre de tu negocio"),
  logoUrl: z.string().nullable(),
  // heroImageUrl no vive acá: se maneja por separado vía
  // /api/business/assets/hero (sube el archivo, nunca recibe una URL cruda
  // del cliente). brandColor sí es un valor simple (no un upload), así que
  // reusa este mismo PATCH — misma regex que sanitizeHexColor(), única
  // fuente de verdad del formato.
  brandColor: z
    .string()
    .nullable()
    .optional()
    .refine((value) => value == null || HEX_COLOR_RE.test(value), "Ingresá un color hexadecimal válido"),
  category: z.enum(BUSINESS_CATEGORIES, {
    message: "Seleccioná un rubro",
  }),
  description: z
    .string()
    .min(10, "Contanos un poco más sobre tu negocio")
    .max(280, "La descripción es demasiado larga"),
  phone: z.string().min(6, "Ingresá un teléfono válido").or(z.literal("")),
  whatsappNumber: z.string().min(6, "Ingresá un número de WhatsApp válido").or(z.literal("")),
  address: z.string().max(200, "La dirección es demasiado larga").or(z.literal("")),
  instagramUrl: z
    .string()
    .url("Ingresá una URL válida")
    .or(z.literal("")),
  facebookUrl: z
    .string()
    .url("Ingresá una URL válida")
    .or(z.literal("")),
});

export type BusinessInfoValues = z.infer<typeof businessInfoSchema>;

// Sección aparte (no dentro de businessInfoSchema): "Pagos y señas" tiene su
// propio PATCH (ver app/api/business/payment-settings/route.ts) y sus
// campos son condicionales entre sí (monto fijo vs. porcentaje) de una forma
// que no tiene sentido mezclar con el formulario de identidad/contacto.
// Cuando depositRequired es false, ningún otro campo se valida — un negocio
// puede desactivar la seña sin tener que primero "arreglar" datos bancarios
// a medio cargar.
export const paymentSettingsSchema = z
  .object({
    depositRequired: z.boolean(),
    depositType: z.enum(DEPOSIT_TYPES).nullable(),
    depositFixedAmount: z.number().min(0).nullable(),
    depositPercentage: z.number().min(0).max(100).nullable(),
    depositAlias: z.string().max(120).nullable(),
    depositCbu: z.string().max(60).nullable(),
    depositBankName: z.string().max(120).nullable(),
    depositAccountHolder: z.string().max(120).nullable(),
    depositTaxId: z.string().max(40).nullable(),
    depositInstructions: z.string().max(500).nullable(),
  })
  .refine((data) => !data.depositRequired || data.depositType != null, {
    message: "Elegí si la seña es un monto fijo o un porcentaje",
    path: ["depositType"],
  })
  .refine(
    (data) => !data.depositRequired || data.depositType !== "fixed" || (data.depositFixedAmount ?? 0) > 0,
    { message: "Ingresá el monto fijo de la seña", path: ["depositFixedAmount"] },
  )
  .refine(
    (data) => !data.depositRequired || data.depositType !== "percentage" || (data.depositPercentage ?? 0) > 0,
    { message: "Ingresá el porcentaje de la seña", path: ["depositPercentage"] },
  );

export type PaymentSettingsValues = z.infer<typeof paymentSettingsSchema>;

// null = auto-detectar la plantilla del sitio público vía getBookingIntent()
// (ver lib/booking-intent.ts) — un valor explícito es la anulación manual
// desde Configuración > Sitio.
export const siteTemplateSchema = z.object({
  siteTemplate: z.enum(SITE_TEMPLATES).nullable(),
});

export type SiteTemplateValues = z.infer<typeof siteTemplateSchema>;

// Variante usada únicamente por el flujo de entrenamiento conversacional:
// mismos campos que businessInfoSchema, pero "category" es texto libre en
// vez del enum cerrado BUSINESS_CATEGORIES. El formulario del dashboard
// necesita un <Select> con opciones finitas; el dueño describiendo su rubro
// en una charla no tiene por qué coincidir con esa lista ("Desarrollo de
// software y IT" no es una opción del dropdown, pero es un rubro válido).
export const trainingBusinessUpdateSchema = z.object({
  name: z.string().min(2, "Ingresá el nombre del negocio").optional(),
  category: z.string().min(1, "Falta el rubro").max(80, "El rubro es demasiado largo").optional(),
  description: z.string().max(280, "La descripción es demasiado larga").optional(),
  phone: z.string().max(40).optional(),
  whatsappNumber: z.string().max(40).optional(),
  address: z.string().max(200, "La dirección es demasiado larga").optional(),
  instagramUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
});

export type TrainingBusinessUpdateValues = z.infer<typeof trainingBusinessUpdateSchema>;

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const scheduleDaySchema = z
  .object({
    day: z.enum(WEEK_DAYS.map((d) => d.id) as [string, ...string[]]),
    enabled: z.boolean(),
    openTime: z.string().regex(timeRegex, "Hora inválida"),
    closeTime: z.string().regex(timeRegex, "Hora inválida"),
    hasBreak: z.boolean(),
    breakStart: z.string().regex(timeRegex, "Hora inválida"),
    breakEnd: z.string().regex(timeRegex, "Hora inválida"),
  })
  .refine((data) => !data.enabled || data.openTime < data.closeTime, {
    message: "El horario de cierre debe ser posterior al de apertura",
    path: ["closeTime"],
  })
  .refine(
    (data) =>
      !data.enabled ||
      !data.hasBreak ||
      (data.breakStart < data.breakEnd &&
        data.breakStart > data.openTime &&
        data.breakEnd < data.closeTime),
    {
      message: "El descanso debe estar dentro del horario de atención",
      path: ["breakEnd"],
    }
  );

export const scheduleSchema = z.array(scheduleDaySchema);

export type ScheduleDayValues = z.infer<typeof scheduleDaySchema>;

export const serviceSchema = z.object({
  name: z.string().min(2, "Ingresá el nombre del servicio"),
  description: z.string().max(200, "La descripción es demasiado larga"),
  category: z.enum(SERVICE_CATEGORIES, {
    message: "Seleccioná una categoría",
  }),
  durationMinutes: z.coerce
    .number()
    .int("Debe ser un número entero")
    .min(5, "La duración mínima es 5 minutos")
    .max(480, "La duración máxima es 8 horas"),
  price: z.coerce.number().min(0, "El precio no puede ser negativo"),
});

export type ServiceFormInput = z.input<typeof serviceSchema>;
export type ServiceFormValues = z.output<typeof serviceSchema>;

// Variante para el flujo de entrenamiento: dos diferencias respecto de
// serviceSchema (el del dashboard), ambas por el mismo motivo — el dashboard
// asume un negocio de turnos (peluquería, consultorio), pero el training
// tiene que servir para cualquier rubro:
// - "category" es texto libre en vez de SERVICE_CATEGORIES (ver arriba).
// - "durationMinutes" es OPCIONAL: no todo servicio es reservable por turno
//   (ej. "Landing Page — USD 250" en una agencia web). Exigirlo obligaba a
//   la IA a inventar una duración que nadie dijo, o rechazaba la propuesta
//   entera si el dueño no daba un dato que no aplica a su negocio. Cuando
//   se omite, createService() lo persiste como 0 — ver isBookableService()
//   en modules/business/service.ts, el punto único que decide qué significa
//   ese 0 para el resto del sistema (booking, rule-engine).
export const trainingServiceSchema = z.object({
  name: z.string().min(2, "Ingresá el nombre del servicio"),
  description: z.string().max(200, "La descripción es demasiado larga").optional(),
  category: z.string().max(60).optional(),
  durationMinutes: z.coerce
    .number()
    .int("Debe ser un número entero")
    .min(5, "La duración mínima es 5 minutos")
    .max(480, "La duración máxima es 8 horas")
    .optional(),
  price: z.coerce.number().min(0, "El precio no puede ser negativo"),
});

export type TrainingServiceValues = z.infer<typeof trainingServiceSchema>;

export const faqSchema = z.object({
  question: z.string().min(5, "Ingresá una pregunta"),
  answer: z.string().min(5, "Ingresá una respuesta"),
});

export type FaqFormValues = z.infer<typeof faqSchema>;

export const employeeProfileSchema = z.object({
  name: z.string().min(2, "Ingresá el nombre del empleado").max(60, "El nombre es demasiado largo"),
  role: z.string().min(2, "Ingresá el rol del empleado").max(80, "El rol es demasiado largo"),
  description: z.string().max(280, "La descripción es demasiado larga").or(z.literal("")),
  formality: z.enum(EMPLOYEE_FORMALITY_LEVELS),
  warmth: z.enum(EMPLOYEE_WARMTH_LEVELS),
  emojiUsage: z.enum(EMPLOYEE_EMOJI_USAGE_LEVELS),
  responseLength: z.enum(EMPLOYEE_RESPONSE_LENGTH_LEVELS),
  commercialLevel: z.enum(EMPLOYEE_COMMERCIAL_LEVEL_LEVELS),
});

export type EmployeeProfileFormValues = z.infer<typeof employeeProfileSchema>;

export const employeeGoalSchema = z.object({
  text: z.string().min(3, "Ingresá un objetivo").max(200, "El objetivo es demasiado largo"),
  active: z.boolean(),
});

export type EmployeeGoalFormValues = z.infer<typeof employeeGoalSchema>;

export const employeeRestrictionSchema = z.object({
  text: z.string().min(3, "Ingresá una restricción").max(200, "La restricción es demasiado larga"),
  active: z.boolean(),
});

export type EmployeeRestrictionFormValues = z.infer<typeof employeeRestrictionSchema>;

export const employeeCapabilitySchema = z.object({
  enabled: z.boolean(),
});

export type EmployeeCapabilityFormValues = z.infer<typeof employeeCapabilitySchema>;

const EMPLOYEE_CAPABILITY_KEYS = EMPLOYEE_CAPABILITIES.map((c) => c.id) as [
  EmployeeCapabilityKey,
  ...EmployeeCapabilityKey[],
];

// Usado por el flujo de entrenamiento: a diferencia de employeeCapabilitySchema
// (que ya sabe la key por la URL del endpoint del dashboard), acá la IA tiene
// que indicar explícitamente qué capacidad está habilitando/deshabilitando.
export const employeeCapabilityUpdateSchema = z.object({
  key: z.enum(EMPLOYEE_CAPABILITY_KEYS),
  enabled: z.boolean(),
});

export type EmployeeCapabilityUpdateValues = z.infer<typeof employeeCapabilityUpdateSchema>;

export const memoryEntrySchema = z.object({
  title: z.string().min(2, "Ingresá un título").max(120, "El título es demasiado largo"),
  content: z.string().min(5, "Ingresá el contenido").max(2000, "El contenido es demasiado largo"),
  category: z.enum(MEMORY_CATEGORIES, { message: "Seleccioná una categoría" }),
  importance: z.enum(MEMORY_IMPORTANCE_LEVELS),
  active: z.boolean(),
});

export type MemoryEntryFormValues = z.infer<typeof memoryEntrySchema>;

// Variante para el flujo de entrenamiento — mismo motivo exacto que
// trainingServiceSchema más abajo: "category" acá es z.enum(MEMORY_CATEGORIES),
// una lista fija pensada para el dropdown del formulario manual del
// dashboard. Pedirle a la IA que acierte uno de esos 10 strings EXACTOS sin
// dárselos nunca en el prompt causaba un rechazo determinístico de Zod en
// cualquier memory_entry (ver modules/ai/prompt/training.ts: "category" se
// mencionaba sin enumerar sus valores válidos) — el bloque proposal entero
// se descartaba, el reintento fallaba por el mismo motivo, y la sección
// quedaba trabada en "in_progress" para siempre. category, importance y
// active quedan opcionales acá; se normalizan/completan recién al persistir
// (ver applyItem en modules/employee/training/proposal.ts), nunca se
// inventa un valor closer a "adivinar" en el propio schema.
export const trainingMemoryEntrySchema = z.object({
  title: z.string().min(2, "Ingresá un título").max(120, "El título es demasiado largo"),
  content: z.string().min(5, "Ingresá el contenido").max(2000, "El contenido es demasiado largo"),
  category: z.string().max(60).optional(),
  importance: z.enum(MEMORY_IMPORTANCE_LEVELS).optional(),
  active: z.boolean().optional(),
});

export type TrainingMemoryEntryValues = z.infer<typeof trainingMemoryEntrySchema>;

export const trainingPlanSectionInputSchema = z.object({
  key: z.string().min(1, "Falta la clave de la sección").max(60),
  title: z.string().min(1, "Falta el título de la sección").max(80),
  description: z.string().min(1, "Falta la descripción de la sección").max(300),
});

export const trainingPlanGenerationSchema = z.object({
  category: z.string().min(1, "Falta el rubro del negocio").max(80),
  description: z.string().max(280, "La descripción es demasiado larga").optional(),
  sections: z.array(trainingPlanSectionInputSchema).min(3).max(12),
});

export type TrainingPlanGenerationValues = z.infer<typeof trainingPlanGenerationSchema>;

export const trainingPlanSectionUpdateSchema = z.object({
  key: z.string().min(1).max(60),
  status: z.enum(AI_PROPOSABLE_SECTION_STATUSES),
});

export type TrainingPlanSectionUpdateValues = z.infer<typeof trainingPlanSectionUpdateSchema>;

export const simulatorCorrectionSchema = z.object({
  customerMessage: z.string().min(1),
  originalReply: z.string().min(1),
  correctedReply: z.string().min(3, "Ingresá la respuesta corregida"),
});

// Turno agendado manualmente desde el dashboard. A propósito tiene la misma
// forma que necesita createAppointment() (modules/appointments/service.ts):
// la ruta POST /api/appointments reutiliza esa función tal cual — el turno
// manual termina siendo un Appointment idéntico a uno creado por WhatsApp,
// no una entidad paralela.
export const manualAppointmentSchema = z.object({
  serviceId: z.string().min(1, "Seleccioná un servicio"),
  customerName: z.string().min(2, "Ingresá el nombre del cliente"),
  customerPhone: z.string().min(6, "Ingresá un teléfono válido"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  startTime: z.string().regex(timeRegex, "Hora inválida"),
  notes: z.string().max(500, "Las notas son demasiado largas").optional(),
  // Ausente = "asignar automáticamente" (el servidor elige el primer recurso
  // libre y determinístico). Si el servicio no usa recursos, se ignora.
  resourceId: z.string().min(1).optional(),
});

// Reprogramación de un turno existente. "resourceId" tiene tres estados
// posibles a propósito (ver RescheduleAppointmentParams en
// modules/appointments/service.ts): campo ausente = mantener el recurso que
// ya tenía; null = "asignar automáticamente" explícito; string = un recurso
// puntual elegido a mano. Por eso es .nullable().optional() y no solo
// .optional() — con solo .optional() no habría forma de distinguir "no
// mandé nada" de "mandé null a propósito".
export const rescheduleAppointmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida"),
  startTime: z.string().regex(timeRegex, "Hora inválida"),
  // Sin z.coerce: a diferencia de serviceSchema, este valor nunca sale de un
  // <input> de texto — siempre viaja tal cual desde el Appointment existente
  // (ver RescheduleAppointmentDialog), así que ya es un number real.
  durationMinutes: z.number().int().min(1),
  resourceId: z.string().min(1).nullable().optional(),
});

export type RescheduleAppointmentValues = z.infer<typeof rescheduleAppointmentSchema>;

export const resourceSchema = z.object({
  name: z.string().min(2, "Ingresá el nombre del recurso"),
  description: z.string().max(200, "La descripción es demasiado larga").optional(),
});

export type ResourceFormValues = z.infer<typeof resourceSchema>;

// Título y descripción opcionales a propósito (sección 1 de la tarea): un
// bloque puede ser solo fotos, sin texto. Sin campo "active" acá — eso se
// togglea aparte (ver galleryBlockUpdateSchema), nunca al crear.
export const galleryBlockSchema = z.object({
  title: z.string().max(80, "El título es demasiado largo").optional(),
  description: z.string().max(240, "La descripción es demasiado larga").optional(),
});

export type GalleryBlockFormValues = z.infer<typeof galleryBlockSchema>;

export const galleryBlockUpdateSchema = galleryBlockSchema.extend({
  active: z.boolean().optional(),
});

export type GalleryBlockUpdateValues = z.infer<typeof galleryBlockUpdateSchema>;

// Reemplaza el conjunto completo de recursos vinculados a un servicio (mismo
// patrón que replaceSchedule): más simple y menos propenso a errores que
// exponer add/remove individuales para una lista chica.
export const serviceResourcesSchema = z.object({
  resourceIds: z.array(z.string().min(1)),
});

export type ManualAppointmentValues = z.infer<typeof manualAppointmentSchema>;

// Contrato de salida de Gemini para generateSeoConfig() (modules/business/seo.ts).
// Límites de longitud alineados a lo que Google realmente trunca en resultados
// de búsqueda — no son arbitrarios.
export const seoConfigGenerationSchema = z.object({
  seoTitle: z.string().min(10, "Muy corto").max(70, "Muy largo para un <title>"),
  metaDescription: z.string().min(50, "Muy corta").max(160, "Muy larga para una meta description"),
  h1: z.string().min(5).max(90),
  ogTitle: z.string().min(10).max(70),
  ogDescription: z.string().min(50).max(200),
  // Uso interno (ver comentario en el modelo SeoConfig) — nunca se renderiza
  // como meta tag.
  keywords: z.array(z.string().min(2).max(40)).min(3, "Necesito al menos 3").max(12),
  extraText: z.string().max(500).optional(),
});

export type SeoConfigGenerationValues = z.infer<typeof seoConfigGenerationSchema>;

export type SimulatorCorrectionValues = z.infer<typeof simulatorCorrectionSchema>;

// ── Superadmin: Planes y suscripciones ───────────────────────────────────

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const planSchema = z.object({
  name: z.string().min(2, "Ingresá el nombre del plan").max(60),
  slug: z.string().min(2).max(40).regex(SLUG_RE, "Solo minúsculas, números y guiones"),
  description: z.string().max(300, "La descripción es demasiado larga").optional(),
  monthlyPrice: z.coerce.number().min(0, "El precio no puede ser negativo"),
  currency: z.string().min(3, "Ej: ARS").max(6),
  // Cantidad de respuestas de IA, no tokens — ver comentario en el modelo
  // Plan (prisma/schema.prisma) y modules/billing/subscription.ts.
  // 0 = el plan no incluye IA (Agenda interna, Esencial).
  aiCredits: z.coerce.number().int().min(0, "No puede ser negativo"),
  // vacío/null = sin límite — ver comentario en el modelo Plan.
  maxServices: z.coerce.number().int().min(1).nullable(),
  publicWebEnabled: z.boolean().default(true),
  whatsappEnabled: z.boolean().default(true),
  depositsEnabled: z.boolean().default(true),
  customTrainingEnabled: z.boolean().default(true),
  statsEnabled: z.boolean().default(true),
  galleryEnabled: z.boolean().default(true),
  digitalMenuEnabled: z.boolean().default(true),
  active: z.boolean().default(true),
});

// input/output separados (no z.infer) por el mismo motivo que ServiceFormInput
// en este mismo archivo: monthlyPrice/aiCredits usan z.coerce.number(), así
// que el tipo ANTES de validar (lo que produce un <input>, string) difiere
// del tipo DESPUÉS (number) — react-hook-form necesita los dos por separado
// (ver useForm<Input, unknown, Output> en components/superadmin/plan-dialog.tsx).
export type PlanFormInput = z.input<typeof planSchema>;
export type PlanFormValues = z.output<typeof planSchema>;

export const planUpdateSchema = planSchema.partial();
export type PlanUpdateValues = z.infer<typeof planUpdateSchema>;

// Asignación manual de plan desde /superadmin/empresas/[id] — sin checkout,
// sin Mercado Pago todavía (ver sección 12 del pedido original). Las fechas
// llegan como string (input type="date", formato YYYY-MM-DD) y se parsean
// en el server.
export const assignSubscriptionSchema = z.object({
  planId: z.string().min(1, "Elegí un plan"),
  status: z.enum(BILLING_SUBSCRIPTION_STATUSES),
  currentPeriodStart: z.string().min(1, "Falta la fecha de inicio"),
  currentPeriodEnd: z.string().optional(),
});

export type AssignSubscriptionValues = z.infer<typeof assignSubscriptionSchema>;

// Bonificación temporal otorgada a mano desde /superadmin/empresas (sección
// 1 del pedido) — a diferencia de assignSubscriptionSchema, siempre exige
// una fecha de vencimiento (una bonificación sin fin no es una bonificación,
// es simplemente asignar el plan a mano, que ya cubre el dialog existente).
export const grantBenefitSchema = z.object({
  planId: z.string().min(1, "Elegí un plan"),
  expiresAt: z.string().min(1, "Falta la fecha de vencimiento"),
});

export type GrantBenefitValues = z.infer<typeof grantBenefitSchema>;

// ── Leads comerciales (landing) ──────────────────────────────────────────
// Público, sin auth (ver app/api/leads/route.ts) — validación real de
// entrada server-side, nunca confiar solo en el <form> del cliente. "website"
// es un honeypot: un campo oculto por CSS que un visitante real nunca
// completa pero un bot que autocompleta todos los inputs sí — si llega con
// contenido, el server responde éxito falso sin crear el Lead (nunca se le
// avisa al bot que fue detectado).
export const leadFormSchema = z.object({
  name: z.string().trim().min(2, "Ingresá tu nombre").max(100),
  businessName: z.string().trim().min(2, "Ingresá el nombre de tu negocio").max(100),
  whatsapp: z.string().trim().min(6, "Ingresá un WhatsApp válido").max(30),
  email: z.string().trim().email("Ingresá un email válido").max(200),
  industry: z.string().trim().min(1, "Elegí un rubro").max(80),
  goals: z.array(z.enum(LEAD_GOALS)).min(1, "Elegí al menos una opción"),
  monthlyVolume: z.enum(LEAD_MONTHLY_VOLUMES).optional(),
  message: z.string().trim().max(500, "Contanos en menos de 500 caracteres").optional(),
  wantsMeeting: z.boolean(),
  // Sin restricción de longitud a propósito: un bot puede escribir cualquier
  // cosa acá (una URL, texto random). Si esto llegara a fallar la
  // validación del schema, la ruta respondería 400 — eso SÍ delataría al
  // bot que algo lo distingue de un envío real. En cambio, este campo
  // siempre pasa el schema, y app/api/leads/route.ts es quien decide en
  // silencio: si viene con contenido, responde éxito falso sin crear el Lead.
  website: z.string().max(200).optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

// ── Consultas del sitio público (Inquiry) ────────────────────────────────
// Solo los 4 campos del formulario + honeypot. "website" sigue el mismo
// criterio que leadFormSchema: nunca falla la validación, la ruta decide en
// silencio qué hacer si viene con contenido.
export const INQUIRY_STATUSES = ["NEW", "IN_PROGRESS", "RESOLVED"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export const inquirySchema = z.object({
  customerName: z.string().trim().min(2, "Ingresá tu nombre").max(100),
  customerWhatsapp: z.string().trim().min(6, "Ingresá un WhatsApp válido").max(30),
  customerEmail: z.string().trim().email("Ingresá un email válido").max(200),
  message: z.string().trim().min(1, "Contanos tu consulta").max(500, "Tu consulta es demasiado larga (máx. 500 caracteres)"),
  website: z.string().max(200).optional(),
});

export type InquiryFormValues = z.infer<typeof inquirySchema>;

export const inquiryStatusUpdateSchema = z.object({
  status: z.enum(INQUIRY_STATUSES),
});

// Actualización desde Superadmin (sección 7 del pedido: estado, notas,
// reunión, conversión) — deliberadamente NO incluye ningún campo que venga
// del formulario público (name/email/goals/etc): un lead no se "reedita" el
// contacto original desde acá, solo se le hace seguimiento.
export const leadUpdateSchema = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  notes: z.string().max(2000, "Las notas son demasiado largas").optional(),
  meetingAt: z.string().optional(),
  convertedBusinessId: z.string().optional(),
});

export type LeadUpdateValues = z.infer<typeof leadUpdateSchema>;

// ── Superadmin: Códigos promocionales ────────────────────────────────────
// Formato NEXO-XXXX-XXX-XXXX de ejemplo (ver generatePromoCode en
// modules/promo-codes/service.ts) pero el campo acepta cualquier string
// razonable — Superadmin puede tipear uno a mano en vez de generarlo.
const PROMO_CODE_RE = /^[A-Z0-9-]+$/;

export const promoCodeSchema = z.object({
  code: z.string().min(4, "El código es muy corto").max(40).regex(PROMO_CODE_RE, "Solo mayúsculas, números y guiones"),
  planId: z.string().min(1, "Elegí un plan"),
  // Días de bonificación — la UI ofrece presets (30/60/90/180/365) más un
  // valor custom, ver comentario en el modelo PromoCode.
  durationDays: z.coerce.number().int().min(1, "Necesita al menos 1 día"),
  // vacío/null = sin límite de usos.
  maxUses: z.coerce.number().int().min(1).nullable(),
  // string (input type="date", YYYY-MM-DD) — se parsea a Date en el server,
  // mismo criterio que assignSubscriptionSchema de arriba.
  expiresAt: z.string().min(1, "Falta la fecha de vencimiento"),
  active: z.boolean().default(true),
  description: z.string().max(300, "La descripción es demasiado larga").optional(),
});

export type PromoCodeFormInput = z.input<typeof promoCodeSchema>;
export type PromoCodeFormValues = z.output<typeof promoCodeSchema>;

export const promoCodeUpdateSchema = promoCodeSchema.partial();
export type PromoCodeUpdateValues = z.infer<typeof promoCodeUpdateSchema>;

// Aplicación por parte del negocio (sección 6 del pedido) — un solo campo,
// nunca expone planId/duración/etc: eso lo decide el código, no quien lo
// aplica.
export const redeemPromoCodeSchema = z.object({
  code: z.string().min(1, "Ingresá un código"),
});

export type RedeemPromoCodeValues = z.infer<typeof redeemPromoCodeSchema>;

// Contratación vía Mercado Pago (Fase 3) — cardTokenId lo genera el
// navegador con Checkout Bricks (CardForm), nunca pasa una tarjeta cruda por
// acá. payerEmail viaja explícito porque es el que se usó para tokenizar la
// tarjeta (no necesariamente el mismo que session.user.email, aunque en la
// práctica suele coincidir).
export const subscriptionCheckoutSchema = z.object({
  planId: z.string().min(1, "Elegí un plan"),
  cardTokenId: z.string().min(1, "Falta el token de la tarjeta"),
  payerEmail: z.string().email("Email inválido"),
});

export type SubscriptionCheckoutValues = z.infer<typeof subscriptionCheckoutSchema>;
