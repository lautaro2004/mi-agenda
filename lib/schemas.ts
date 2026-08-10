import { z } from "zod";
import {
  AI_PROPOSABLE_SECTION_STATUSES,
  BUSINESS_CATEGORIES,
  EMPLOYEE_CAPABILITIES,
  EMPLOYEE_COMMERCIAL_LEVEL_LEVELS,
  EMPLOYEE_EMOJI_USAGE_LEVELS,
  EMPLOYEE_FORMALITY_LEVELS,
  EMPLOYEE_RESPONSE_LENGTH_LEVELS,
  EMPLOYEE_WARMTH_LEVELS,
  MEMORY_CATEGORIES,
  MEMORY_IMPORTANCE_LEVELS,
  SERVICE_CATEGORIES,
  WEEK_DAYS,
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

export const loginSchema = z.object({
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const businessInfoSchema = z.object({
  name: z.string().min(2, "Ingresá el nombre de tu negocio"),
  logoUrl: z.string().nullable(),
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

// Reemplaza el conjunto completo de recursos vinculados a un servicio (mismo
// patrón que replaceSchedule): más simple y menos propenso a errores que
// exponer add/remove individuales para una lista chica.
export const serviceResourcesSchema = z.object({
  resourceIds: z.array(z.string().min(1)),
});

export type ManualAppointmentValues = z.infer<typeof manualAppointmentSchema>;

export type SimulatorCorrectionValues = z.infer<typeof simulatorCorrectionSchema>;
