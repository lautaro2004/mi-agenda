import { getBusinessState } from "@/modules/business/service";
import { getEmployeeProfile } from "@/modules/employee/profile";
import { getActiveMemoryEntries } from "@/modules/employee/memory";
import { getTrainingPlan } from "@/modules/employee/training-plan";
import type { BusinessContext } from "@/modules/ai/providers/base";

export async function buildBusinessContext(
  businessId: string,
  _opts?: { query?: string }
): Promise<BusinessContext> {
  const [state, employee, memory, trainingPlan] = await Promise.all([
    getBusinessState(businessId),
    getEmployeeProfile(businessId),
    getActiveMemoryEntries(businessId),
    getTrainingPlan(businessId),
  ]);

  return { ...state, employee, memory, trainingPlan };
}
