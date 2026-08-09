import { prisma } from "@/lib/prisma";
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

async function ensureEmployee(businessId: string) {
  const existing = await prisma.employee.findUnique({
    where: { businessId },
    include: { goals: true, restrictions: true, capabilities: true },
  });
  if (existing) return existing;

  return prisma.employee.create({
    data: {
      businessId,
      capabilities: { create: EMPLOYEE_CAPABILITIES.map((c) => ({ key: c.id, enabled: true })) },
    },
    include: { goals: true, restrictions: true, capabilities: true },
  });
}

export async function getEmployeeProfile(businessId: string): Promise<EmployeeProfile> {
  const employee = await ensureEmployee(businessId);
  return toClientProfile(employee);
}

export async function updateEmployeeProfile(
  businessId: string,
  data: EmployeeProfileFormValues
): Promise<EmployeeProfile> {
  await ensureEmployee(businessId);
  const employee = await prisma.employee.update({
    where: { businessId },
    data,
    include: { goals: true, restrictions: true, capabilities: true },
  });
  return toClientProfile(employee);
}

export async function createGoal(businessId: string, data: EmployeeGoalFormValues): Promise<EmployeeGoal> {
  const employee = await ensureEmployee(businessId);
  const row = await prisma.employeeGoal.create({ data: { employeeId: employee.id, ...data } });
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
  data: EmployeeRestrictionFormValues
): Promise<EmployeeRestriction> {
  const employee = await ensureEmployee(businessId);
  const row = await prisma.employeeRestriction.create({ data: { employeeId: employee.id, ...data } });
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
  enabled: boolean
): Promise<EmployeeCapability> {
  const employee = await ensureEmployee(businessId);
  await prisma.employeeCapability.upsert({
    where: { employeeId_key: { employeeId: employee.id, key } },
    update: { enabled },
    create: { employeeId: employee.id, key, enabled },
  });
  return { key, enabled };
}
