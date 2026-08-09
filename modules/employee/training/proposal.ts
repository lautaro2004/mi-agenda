import { z } from "zod";

import {
  businessInfoSchema,
  employeeGoalSchema,
  employeeProfileSchema,
  employeeRestrictionSchema,
  memoryEntrySchema,
  scheduleDaySchema,
  serviceSchema,
  trainingPlanGenerationSchema,
  trainingPlanSectionUpdateSchema,
} from "@/lib/schemas";
import { AI_PROPOSABLE_SECTION_STATUSES } from "@/lib/types";
import { createService, getBusinessState, replaceSchedule, updateBusinessInfo } from "@/modules/business/service";
import { createGoal, createRestriction, getEmployeeProfile, updateEmployeeProfile } from "@/modules/employee/profile";
import { createMemoryEntry } from "@/modules/employee/memory";
import { generateTrainingPlan, setSectionStatus } from "@/modules/employee/training-plan";

// Cualquier propuesta puede venir "etiquetada" con la sección del Training
// Plan que satisface, para que quede marcada como completada/ignorada en el
// mismo paso — sin necesitar un segundo bloque de propuesta por turno.
const trackingFields = {
  sectionKey: z.string().min(1).max(60).optional(),
  sectionStatus: z.enum(AI_PROPOSABLE_SECTION_STATUSES).optional(),
};

// Un único punto de entrada para persistir lo que el motor de entrenamiento
// propone. Nunca toca Prisma directamente: siempre reutiliza los servicios
// ya existentes (mismos que usa el dashboard).
export const trainingProposalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("business"), summary: z.string(), data: businessInfoSchema.partial(), ...trackingFields }),
  z.object({ kind: z.literal("service"), summary: z.string(), data: serviceSchema, ...trackingFields }),
  z.object({ kind: z.literal("schedule_day"), summary: z.string(), data: scheduleDaySchema, ...trackingFields }),
  z.object({
    kind: z.literal("employee_profile"),
    summary: z.string(),
    data: employeeProfileSchema.partial(),
    ...trackingFields,
  }),
  z.object({ kind: z.literal("employee_goal"), summary: z.string(), data: employeeGoalSchema, ...trackingFields }),
  z.object({
    kind: z.literal("employee_restriction"),
    summary: z.string(),
    data: employeeRestrictionSchema,
    ...trackingFields,
  }),
  z.object({ kind: z.literal("memory_entry"), summary: z.string(), data: memoryEntrySchema, ...trackingFields }),
  z.object({
    kind: z.literal("training_plan"),
    summary: z.string(),
    data: trainingPlanGenerationSchema,
    ...trackingFields,
  }),
  z.object({
    kind: z.literal("training_plan_section"),
    summary: z.string(),
    data: trainingPlanSectionUpdateSchema,
    ...trackingFields,
  }),
]);

export type TrainingProposal = z.infer<typeof trainingProposalSchema>;

export async function applyTrainingProposal(businessId: string, proposal: TrainingProposal): Promise<void> {
  switch (proposal.kind) {
    case "business":
      await updateBusinessInfo(businessId, proposal.data);
      break;

    case "service":
      await createService(businessId, proposal.data);
      break;

    case "schedule_day": {
      const state = await getBusinessState(businessId);
      const nextSchedule = state.schedule.map((day) =>
        day.day === proposal.data.day ? { ...day, ...proposal.data, day: day.day } : day
      );
      await replaceSchedule(businessId, nextSchedule);
      break;
    }

    case "employee_profile": {
      const current = await getEmployeeProfile(businessId);
      await updateEmployeeProfile(businessId, {
        name: current.name,
        role: current.role,
        description: current.description,
        formality: current.formality,
        warmth: current.warmth,
        emojiUsage: current.emojiUsage,
        responseLength: current.responseLength,
        commercialLevel: current.commercialLevel,
        ...proposal.data,
      });
      break;
    }

    case "employee_goal":
      await createGoal(businessId, proposal.data);
      break;

    case "employee_restriction":
      await createRestriction(businessId, proposal.data);
      break;

    case "memory_entry":
      await createMemoryEntry(businessId, proposal.data, "training_conversation");
      break;

    case "training_plan":
      await generateTrainingPlan(businessId, proposal.data);
      return; // el plan ya es la sección en sí; no hay tagging adicional que aplicar

    case "training_plan_section":
      await setSectionStatus(businessId, proposal.data.key, proposal.data.status);
      return;
  }

  if (proposal.sectionKey && proposal.sectionStatus) {
    await setSectionStatus(businessId, proposal.sectionKey, proposal.sectionStatus);
  }
}
