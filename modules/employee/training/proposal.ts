import { z } from "zod";

import {
  employeeCapabilityUpdateSchema,
  employeeGoalSchema,
  employeeProfileSchema,
  employeeRestrictionSchema,
  faqSchema,
  trainingBusinessUpdateSchema,
  trainingMemoryEntrySchema,
  trainingPlanGenerationSchema,
  trainingPlanSectionUpdateSchema,
  trainingServiceSchema,
} from "@/lib/schemas";
import { AI_PROPOSABLE_SECTION_STATUSES, MEMORY_CATEGORIES, type MemoryCategory } from "@/lib/types";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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
//
// "memory_entry" usa trainingMemoryEntrySchema (no memoryEntrySchema, el del
// formulario manual del dashboard) — ver el comentario largo en
// lib/schemas.ts. Esta fue la causa real de "Tuve un problema guardando esa
// parte" reproducida en producción: memoryEntrySchema exige
// z.enum(MEMORY_CATEGORIES) pero el prompt nunca le decía a la IA cuáles
// eran esos valores, así que CUALQUIER memory_entry con una categoría
// inventada (casi todos) rompía la validación Zod antes de tocar la base —
// nunca era un error de Prisma/constraint, ni el retry existente lo podía
// arreglar porque el prompt seguía sin darle las opciones válidas en el
// segundo intento tampoco.
const proposalItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("business"), data: trainingBusinessUpdateSchema }),
  z.object({ kind: z.literal("service"), data: trainingServiceSchema }),
  z.object({ kind: z.literal("faq"), data: faqSchema }),
  z.object({ kind: z.literal("employee_profile"), data: employeeProfileSchema.partial() }),
  z.object({ kind: z.literal("employee_goal"), data: employeeGoalSchema }),
  z.object({ kind: z.literal("employee_restriction"), data: employeeRestrictionSchema }),
  z.object({ kind: z.literal("employee_capability"), data: employeeCapabilityUpdateSchema }),
  z.object({ kind: z.literal("memory_entry"), data: trainingMemoryEntrySchema }),
]);

export type ProposalItem = z.infer<typeof proposalItemSchema>;

// Los únicos dos kinds "genéricos": no tienen una entidad estructurada
// propia distinta de "lo que se esté hablando en este momento", así que son
// los únicos para los que es seguro inferir que corresponden a la sección
// activa cuando la IA no la tagueó explícitamente. Ver isSafeToInferClose().
const GENERIC_KNOWLEDGE_KINDS = new Set<ProposalItem["kind"]>(["faq", "memory_entry"]);

// La IA recibe la lista completa de categorías válidas en el prompt (ver
// modules/ai/prompt/training.ts) y casi siempre acierta el string exacto —
// esto es la red de seguridad para cuando no lo hace (mayúsculas distintas,
// acentos, o directamente inventa algo): nunca se rechaza el batch entero
// por esto, se resuelve al bucket más parecido y, si no hay ninguno, "Otro".
// El backend nunca depende únicamente del prompt para esto.
function normalizeMemoryCategory(raw: string | undefined): MemoryCategory {
  if (!raw) return "Otro";
  const trimmed = raw.trim().toLowerCase();
  const exact = MEMORY_CATEGORIES.find((c) => c.toLowerCase() === trimmed);
  return exact ?? "Otro";
}

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
      await createMemoryEntry(
        businessId,
        {
          title: item.data.title,
          content: item.data.content,
          category: normalizeMemoryCategory(item.data.category),
          importance: item.data.importance ?? "medium",
          active: item.data.active ?? true,
        },
        "training_conversation",
        db
      );
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

// Códigos de Prisma que representan una falla TRANSITORIA de infraestructura
// (conexión caída, timeout, pool agotado) — nunca un dato inválido. Reintentar
// P2002 (constraint única) o P2003/P2025 (FK/registro inexistente) no
// arreglaría nada: son deterministas, van a fallar exactamente igual la
// segunda vez, y esconder eso detrás de un retry silencioso ocultaría un bug
// real en vez de recuperarse de un problema de infraestructura.
const RETRYABLE_PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024", "P2028", "P2034"]);

function isRetryableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_PRISMA_CODES.has(error.code);
  }
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  // Errores crudos del driver pg (ver lib/prisma.ts: onPoolError/onConnectionError)
  // que no siempre llegan envueltos en un PrismaClientKnownRequestError.
  if (error instanceof Error && /connection|econnreset|etimedout|timeout/i.test(error.message)) return true;
  return false;
}

function describePrismaError(error: unknown): { code: string | null; meta: unknown; message: string } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return { code: error.code, meta: error.meta ?? null, message: error.message };
  }
  if (error instanceof Error) return { code: null, meta: null, message: error.message };
  return { code: null, meta: null, message: String(error) };
}

// Log estructurado y completo del fallo real — nunca se le muestra este
// detalle al dueño (la ruta /apply sigue devolviendo un mensaje genérico),
// pero acá queda todo lo necesario para diagnosticar sin adivinar: qué
// operación era, qué sección estaba en juego, qué tipo de proposal, y el
// error de Prisma/DB tal cual (code/meta/message) cuando corresponde.
function logPersistenceFailure(ctx: {
  operation: TrainingProposal["kind"];
  businessId: string;
  sectionKey: string | null;
  attempt: number;
  error: unknown;
}): void {
  const dbError = describePrismaError(ctx.error);
  console.error("[training/proposal] Falló la persistencia de una propuesta.", {
    operation: ctx.operation,
    businessId: ctx.businessId,
    trainingPlanSection: ctx.sectionKey,
    attempt: ctx.attempt,
    dbErrorCode: dbError.code,
    dbErrorMeta: dbError.meta,
    dbErrorMessage: dbError.message,
    retryable: isRetryableError(ctx.error),
  });
}

// Toda la propuesta (items + cierre de sección, cuando aplica) vive DENTRO
// de la misma transacción — antes setSectionStatus()/activateNextPendingSection()
// corrían DESPUÉS del $transaction de knowledge_batch, sueltas: si esos dos
// pasos fallaban (ej. un blip de conexión justo ahí), los items YA estaban
// committeados pero la función igual tiraba error, la ruta /apply respondía
// "no pudimos guardar", y un reintento del dueño con la MISMA propuesta
// volvía a crear los mismos FAQs/memory_entries — nada los deduplicaba. Con
// todo adentro de una única transacción, cualquier falla en cualquier paso
// revierte TODO: un reintento desde cero siempre es seguro porque nunca hay
// un commit parcial del que partir.
async function applyTrainingProposalOnce(businessId: string, proposal: TrainingProposal): Promise<void> {
  switch (proposal.kind) {
    case "training_plan":
      await prisma.$transaction(async (tx) => {
        await generateTrainingPlan(businessId, proposal.data, tx);
        // Generar el plan persiste el rubro en Business de forma garantizada
        // (no depende de que la IA además se acuerde de proponer un item
        // "business" aparte): el category del plan y el de Business son
        // conceptos relacionados pero separados a propósito, y este es el
        // único punto donde SIEMPRE deben sincronizarse.
        await updateBusinessInfo(
          businessId,
          {
            category: proposal.data.category,
            ...(proposal.data.description ? { description: proposal.data.description } : {}),
          },
          tx
        );
        await activateNextPendingSection(businessId, tx);
      });
      return;

    case "training_plan_section":
      await prisma.$transaction(async (tx) => {
        await setSectionStatus(businessId, proposal.data.key, proposal.data.status, tx);
        await activateNextPendingSection(businessId, tx);
      });
      return;

    case "knowledge_batch": {
      await prisma.$transaction(async (tx) => {
        for (const item of proposal.items) {
          await applyItem(tx, businessId, item);
        }

        const targetKey =
          proposal.sectionKey ?? (isSafeToInferClose(proposal.items) ? await getActiveSectionKey(businessId, tx) : null);
        if (targetKey) {
          await setSectionStatus(businessId, targetKey, proposal.sectionStatus ?? "completed", tx);
          await activateNextPendingSection(businessId, tx);
        }
      });
      return;
    }
  }
}

const MAX_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 250;

function sectionKeyForLog(proposal: TrainingProposal): string | null {
  if (proposal.kind === "training_plan_section") return proposal.data.key;
  if (proposal.kind === "knowledge_batch") return proposal.sectionKey ?? null;
  return null;
}

// Único punto de entrada para persistir lo que el motor de entrenamiento
// propone. Nunca toca Prisma directamente para las entidades del negocio:
// siempre reutiliza los servicios ya existentes (mismos que usa el
// dashboard) — solo orquesta la transacción, el reintento y el logging.
//
// "knowledge_batch" reemplaza al viejo esquema de un kind+data por turno: una
// sola propuesta puede traer varios items (ej. tres servicios a la vez), el
// dueño confirma una sola vez, y se crean los tres.
export async function applyTrainingProposal(businessId: string, proposal: TrainingProposal): Promise<void> {
  let attempt = 1;

  while (true) {
    try {
      await applyTrainingProposalOnce(businessId, proposal);
      return;
    } catch (error) {
      logPersistenceFailure({ operation: proposal.kind, businessId, sectionKey: sectionKeyForLog(proposal), attempt, error });

      if (attempt < MAX_ATTEMPTS && isRetryableError(error)) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * attempt));
        attempt += 1;
        continue;
      }

      // La transacción ya revirtió cualquier escritura parcial (ver el
      // comentario en applyTrainingProposalOnce) — nada quedó guardado a
      // medias. La excepción sube igual (la ruta /apply la convierte en un
      // 503 con mensaje genérico) y ninguna sección se marca completada.
      throw error;
    }
  }
}
