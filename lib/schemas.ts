import { z } from "zod";
import {
  AI_PROPOSABLE_SECTION_STATUSES,
  BUSINESS_CATEGORIES,
  EMPLOYEE_COMMERCIAL_LEVEL_LEVELS,
  EMPLOYEE_EMOJI_USAGE_LEVELS,
  EMPLOYEE_FORMALITY_LEVELS,
  EMPLOYEE_RESPONSE_LENGTH_LEVELS,
  EMPLOYEE_WARMTH_LEVELS,
  MEMORY_CATEGORIES,
  MEMORY_IMPORTANCE_LEVELS,
  SERVICE_CATEGORIES,
  WEEK_DAYS,
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

export type SimulatorCorrectionValues = z.infer<typeof simulatorCorrectionSchema>;
