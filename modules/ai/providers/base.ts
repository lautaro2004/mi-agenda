import type {
  Business,
  BusinessSchedule,
  EmployeeProfile,
  FAQ,
  MemoryEntry,
  Service,
  TrainingPlan,
} from "@/lib/types";
import type { AttributionMethod, CampaignConfig } from "@/lib/campaigns";
import type { ProposalDraft } from "@/lib/types";
import type { BuiltPrompt } from "@/modules/ai/prompt/builder";
import type { AiUsageMeta } from "@/modules/ai/usage";

export interface BusinessContext {
  business: Business;
  services: Service[];
  faqs: FAQ[];
  schedule: BusinessSchedule;
  employee: EmployeeProfile;
  memory: MemoryEntry[];
  trainingPlan: TrainingPlan | null;
  // Campaña de WhatsApp de origen de la conversación en curso (si la hay).
  campaign?: {
    config: CampaignConfig;
    method: AttributionMethod;
    draft?: ProposalDraft | null;
    hasBookableServices: boolean;
  } | null;
}

export interface AIProvider {
  readonly modelId: string;
  // meta es opcional para no romper callers existentes, pero cuando se pasa
  // habilita el registro de consumo real (tokens, modelo, operación) en
  // AiUsageEvent — ver modules/ai/usage.ts. Sin meta, la llamada funciona
  // igual, solo que ese consumo queda sin contabilizar.
  generateResponse(
    message: string,
    history: Array<{ role: "user" | "model"; text: string }>,
    prompt: BuiltPrompt,
    meta?: AiUsageMeta
  ): Promise<string>;
}
