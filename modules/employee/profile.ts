import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { EMPLOYEE_CAPABILITIES } from "@/lib/types";
import type {
  EmployeeCapability,
  EmployeeCapabilityKey,
  EmployeeCommercialLevel,
  EmployeeEmojiUsage,
  EmployeeFormality,
  EmployeeGoal,
  EmployeeProfile,
  EmployeeResponseLength,
  EmployeeRestriction,
  EmployeeWarmth,
} from "@/lib/types";
import type {
  EmployeeGoalFormValues,
  EmployeeProfileFormValues,
  EmployeeRestrictionFormValues,
} from "@/lib/schemas";

// Ver el mismo patrón en modules/business/service.ts: permite que
// applyTrainingProposal() ejecute varias de estas escrituras dentro de un
// único prisma.$transaction() para que un knowledge_batch se guarde todo o
// nada. El resto de los callers (rutas del dashboard) no pasan "db" y siguen
// usando el singleton de siempre.
type Db = Prisma.TransactionClient;

type EmployeeWithRelations = NonNullable<Awaited<ReturnType<typeof ensureEmployee>>>;

function toClientCapabilities(rows: { key: string; enabled: boolean }[]): EmployeeCapability[] {
  const byKey = new Map(rows.map((r) => [r.key, r.enabled]));
  return EMPLOYEE_CAPABILITIES.map((c) => ({ key: c.id, enabled: byKey.get(c.id) ?? true }));
}

function toClientProfile(row: EmployeeWithRelations): EmployeeProfile {
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    role: row.role,
    description: row.description ?? "",
    formality: row.formality as EmployeeFormality,
    warmth: row.warmth as EmployeeWarmth,
    emojiUsage: row.emojiUsage as EmployeeEmojiUsage,
    responseLength: row.responseLength as EmployeeResponseLength,
    commercialLevel: row.commercialLevel as EmployeeCommercialLevel,
    goals: row.goals.map((g) => ({ id: g.id, text: g.text, active: g.active })),
    restrictions: row.restrictions.map((r) => ({ id: r.id, text: r.text, active: r.active })),
    capabilities: toClientCapabilities(row.capabilities),
  };
}

async function ensureEmployee(businessId: string, db: Db = prisma) {
  const existing = await db.employee.findUnique({
    where: { businessId },
    include: { goals: true, restrictions: true, capabilities: true },
  });
  if (existing) return existing;

  return db.employee.create({
    data: {
      businessId,
      capabilities: { create: EMPLOYEE_CAPABILITIES.map((c) => ({ key: c.id, enabled: true })) },
    },
    include: { goals: true, restrictions: true, capabilities: true },
  });
}

export async function getEmployeeProfile(businessId: string, db: Db = prisma): Promise<EmployeeProfile> {
  const employee = await ensureEmployee(businessId, db);
  return toClientProfile(employee);
}

export async function updateEmployeeProfile(
  businessId: string,
  data: EmployeeProfileFormValues,
  db: Db = prisma
): Promise<EmployeeProfile> {
  await ensureEmployee(businessId, db);
  const employee = await db.employee.update({
    where: { businessId },
    data,
    include: { goals: true, restrictions: true, capabilities: true },
  });
  return toClientProfile(employee);
}

export async function createGoal(
  businessId: string,
  data: EmployeeGoalFormValues,
  db: Db = prisma
): Promise<EmployeeGoal> {
  const employee = await ensureEmployee(businessId, db);
  const row = await db.employeeGoal.create({ data: { employeeId: employee.id, ...data } });
  return { id: row.id, text: row.text, active: row.active };
}

export async function updateGoal(
  businessId: string,
  id: string,
  data: EmployeeGoalFormValues
): Promise<EmployeeGoal | null> {
  const result = await prisma.employeeGoal.updateMany({
    where: { id, employee: { businessId } },
    data,
  });
  if (result.count === 0) return null;
  const row = await prisma.employeeGoal.findUniqueOrThrow({ where: { id } });
  return { id: row.id, text: row.text, active: row.active };
}

export async function deleteGoal(businessId: string, id: string): Promise<boolean> {
  const result = await prisma.employeeGoal.deleteMany({ where: { id, employee: { businessId } } });
  return result.count > 0;
}

export async function createRestriction(
  businessId: string,
  data: EmployeeRestrictionFormValues,
  db: Db = prisma
): Promise<EmployeeRestriction> {
  const employee = await ensureEmployee(businessId, db);
  const row = await db.employeeRestriction.create({ data: { employeeId: employee.id, ...data } });
  return { id: row.id, text: row.text, active: row.active };
}

export async function updateRestriction(
  businessId: string,
  id: string,
  data: EmployeeRestrictionFormValues
): Promise<EmployeeRestriction | null> {
  const result = await prisma.employeeRestriction.updateMany({
    where: { id, employee: { businessId } },
    data,
  });
  if (result.count === 0) return null;
  const row = await prisma.employeeRestriction.findUniqueOrThrow({ where: { id } });
  return { id: row.id, text: row.text, active: row.active };
}

export async function deleteRestriction(businessId: string, id: string): Promise<boolean> {
  const result = await prisma.employeeRestriction.deleteMany({ where: { id, employee: { businessId } } });
  return result.count > 0;
}

export async function setCapability(
  businessId: string,
  key: EmployeeCapabilityKey,
  enabled: boolean,
  db: Db = prisma
): Promise<EmployeeCapability> {
  const employee = await ensureEmployee(businessId, db);
  await db.employeeCapability.upsert({
    where: { employeeId_key: { employeeId: employee.id, key } },
    update: { enabled },
    create: { employeeId: employee.id, key, enabled },
  });
  return { key, enabled };
}
