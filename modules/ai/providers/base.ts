import type {
  Business,
  BusinessSchedule,
  EmployeeProfile,
  FAQ,
  MemoryEntry,
  Service,
  TrainingPlan,
} from "@/lib/types";
import type { BuiltPrompt } from "@/modules/ai/prompt/builder";

export interface BusinessContext {
  business: Business;
  services: Service[];
  faqs: FAQ[];
  schedule: BusinessSchedule;
  employee: EmployeeProfile;
  memory: MemoryEntry[];
  trainingPlan: TrainingPlan | null;
}

export interface AIProvider {
  readonly modelId: string;
  generateResponse(
    message: string,
    history: Array<{ role: "user" | "model"; text: string }>,
    prompt: BuiltPrompt
  ): Promise<string>;
}
