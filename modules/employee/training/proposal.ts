import { z } from "zod";

import {
  employeeCapabilityUpdateSchema,
  employeeGoalSchema,
  employeeProfileSchema,
  employeeRestrictionSchema,
  faqSchema,
  memoryEntrySchema,
  trainingBusinessUpdateSchema,
  trainingPlanGenerationSchema,
  trainingPlanSectionUpdateSchema,
  trainingServiceSchema,
} from "@/lib/schemas";
import { AI_PROPOSABLE_SECTION_STATUSES } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { createFaq, createService, updateBusinessInfo } from "@/modules/business/service";
import {
  createGoal,
  createRestriction,
  getEmployeeProfile,
  setCapability,
  updateEmployeeProfile,
} from "@/modules/employee/profile";
import { createMemoryEntry } from "@/modules/employee/memory";
import {
  activateNextPendingSection,
  generateTrainingPlan,
  getActiveSectionKey,
  setSectionStatus,
} from "@/modules/employee/training-plan";

// Horarios queda deliberadamente afuera: ya tiene su propia UI estructurada
// (/onboarding/horarios, /dashboard/horarios) sobre el modelo Schedule real.
// La IA nunca propone horarios — ver modules/ai/prompt/training.ts.
//
// Un "item" es una operación atómica sobre UNA entidad real del negocio.
// Todo lo que la IA aprende durante el entrenamiento se traduce a uno de
// estos — nunca a Prisma directo, siempre a los mismos servicios que ya usa
// el dashboard. memory_entry queda como último recurso: cuando el dato no
// tiene una entidad estructurada mejor.
const proposalItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("business"), data: trainingBusinessUpdateSchema }),
  z.object({ kind: z.literal("service"), data: trainingServiceSchema }),
  z.object({ kind: z.literal("faq"), data: faqSchema }),
  z.object({ kind: z.literal("employee_profile"), data: employeeProfileSchema.partial() }),
  z.object({ kind: z.literal("employee_goal"), data: employeeGoalSchema }),
  z.object({ kind: z.literal("employee_restriction"), data: employeeRestrictionSchema }),
  z.object({ kind: z.literal("employee_capability"), data: employeeCapabilityUpdateSchema }),
  z.object({ kind: z.literal("memory_entry"), data: memoryEntrySchema }),
]);

export type ProposalItem = z.infer<typeof proposalItemSchema>;

// Los únicos dos kinds "genéricos": no tienen una entidad estructurada
// propia distinta de "lo que se esté hablando en este momento", así que son
// los únicos para los que es seguro inferir que corresponden a la sección
// activa cuando la IA no la tagueó explícitamente. Ver isSafeToInferClose().
const GENERIC_KNOWLEDGE_KINDS = new Set<ProposalItem["kind"]>(["faq", "memory_entry"]);

// Un único punto de entrada para persistir lo que el motor de entrenamiento
// propone. Nunca toca Prisma directamente para las entidades del negocio:
// siempre reutiliza los servicios ya existentes (mismos que usa el
// dashboard) — solo orquesta la transacción.
//
// "knowledge_batch" reemplaza al viejo esquema de un kind+data por turno: una
// sola propuesta puede traer varios items (ej. tres servicios a la vez), el
// dueño confirma una sola vez, y se crean los tres.
export const trainingProposalSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("training_plan"), summary: z.string(), data: trainingPlanGenerationSchema }),
  z.object({
    kind: z.literal("training_plan_section"),
    summary: z.string(),
    data: trainingPlanSectionUpdateSchema,
  }),
  z.object({
    kind: z.literal("knowledge_batch"),
    summary: z.string(),
    items: z.array(proposalItemSchema).min(1).max(20),
    sectionKey: z.string().min(1).max(60).optional(),
    sectionStatus: z.enum(AI_PROPOSABLE_SECTION_STATUSES).optional(),
  }),
]);

export type TrainingProposal = z.infer<typeof trainingProposalSchema>;

type Db = Prisma.TransactionClient;

async function applyItem(db: Db, businessId: string, item: ProposalItem): Promise<void> {
  switch (item.kind) {
    case "business":
      await updateBusinessInfo(businessId, item.data, db);
      return;

    case "service":
      await createService(businessId, item.data, db);
      return;

    case "faq":
      await createFaq(businessId, item.data, db);
      return;

    case "employee_profile": {
      const current = await getEmployeeProfile(businessId, db);
      await updateEmployeeProfile(
        businessId,
        {
          name: current.name,
          role: current.role,
          description: current.description,
          formality: current.formality,
          warmth: current.warmth,
          emojiUsage: current.emojiUsage,
          responseLength: current.responseLength,
          commercialLevel: current.commercialLevel,
          ...item.data,
        },
        db
      );
      return;
    }

    case "employee_goal":
      await createGoal(businessId, item.data, db);
      return;

    case "employee_restriction":
      await createRestriction(businessId, item.data, db);
      return;

    case "employee_capability":
      await setCapability(businessId, item.data.key, item.data.enabled, db);
      return;

    case "memory_entry":
      await createMemoryEntry(businessId, item.data, "training_conversation", db);
      return;
  }
}

// Ver GENERIC_KNOWLEDGE_KINDS: si el batch incluye algo estructural (un
// servicio, un dato del negocio, el perfil del empleado) no alcanza con que
// "hubo una propuesta" para dar por cerrada la sección activa — podría ser
// un dato suelto que la IA guardó de paso mientras hablaba de otra cosa (el
// caso concreto que motivó esto: guardar un service mencionado al pasar no
// debe cerrar la sección "Proceso de trabajo"). Sin sectionKey explícito, la
// inferencia automática solo es segura cuando TODO el batch es conocimiento
// genérico (faq/memory_entry), porque eso por definición es "información
// sobre el tema que se está conversando ahora".
function isSafeToInferClose(items: ProposalItem[]): boolean {
  return items.every((item) => GENERIC_KNOWLEDGE_KINDS.has(item.kind));
}

export async function applyTrainingProposal(businessId: string, proposal: TrainingProposal): Promise<void> {
  switch (proposal.kind) {
    case "training_plan":
      await generateTrainingPlan(businessId, proposal.data);
      // Generar el plan persiste el rubro en Business de forma garantizada
      // (no depende de que la IA además se acuerde de proponer un item
      // "business" aparte): el category del plan y el de Business son
      // conceptos relacionados pero separados a propósito, y este es el
      // único punto donde SIEMPRE deben sincronizarse.
      await updateBusinessInfo(businessId, {
        category: proposal.data.category,
        ...(proposal.data.description ? { description: proposal.data.description } : {}),
      });
      await activateNextPendingSection(businessId);
      return;

    case "training_plan_section":
      await setSectionStatus(businessId, proposal.data.key, proposal.data.status);
      await activateNextPendingSection(businessId);
      return;

    case "knowledge_batch": {
      // Todo el batch se persiste dentro de una única transacción: si un
      // item falla a mitad de camino (ej. el segundo de tres servicios), los
      // que ya se habían escrito en esta misma llamada se revierten — nunca
      // queda un guardado parcial silencioso que el dueño no pueda ver ni
      // que quede reintentable sin duplicar lo que sí entró. La excepción
      // sube igual (la ruta /apply la convierte en un 503 con mensaje
      // claro) y ninguna sección se marca completada.
      await prisma.$transaction(async (tx) => {
        for (const item of proposal.items) {
          await applyItem(tx, businessId, item);
        }
      });

      const targetKey =
        proposal.sectionKey ?? (isSafeToInferClose(proposal.items) ? await getActiveSectionKey(businessId) : null);
      if (targetKey) {
        await setSectionStatus(businessId, targetKey, proposal.sectionStatus ?? "completed");
        await activateNextPendingSection(businessId);
      }
      return;
    }
  }
}
