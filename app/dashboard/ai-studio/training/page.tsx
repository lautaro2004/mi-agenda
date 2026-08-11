"use client";

import * as React from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/dashboard/page-header";
import { TrainingChat } from "@/components/ai-studio/training-chat";
import { TrainingPlanStatus } from "@/components/ai-studio/training-plan-status";
import { requestJson } from "@/lib/api-client";
import type { TrainingPlan } from "@/lib/types";

export default function TrainingPage() {
  const [plan, setPlan] = React.useState<TrainingPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = React.useState(true);
  const [resumingKey, setResumingKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    requestJson<{ plan: TrainingPlan | null }>("/api/ai-studio/training-plan")
      .then(({ plan }) => setPlan(plan))
      .catch(() => setPlan(null))
      .finally(() => setLoadingPlan(false));
  }, []);

  async function resumeSection(key: string) {
    setResumingKey(key);
    try {
      const { plan: updated } = await requestJson<{ plan: TrainingPlan | null }>(
        `/api/ai-studio/training-plan/${encodeURIComponent(key)}/resume`,
        { method: "POST" }
      );
      setPlan(updated);
      toast.success("Listo, contale a la IA cuando quieras — ya es el tema activo del chat.");
    } catch {
      toast.error("No pudimos activar esa sección. Intentá de nuevo.");
    } finally {
      setResumingKey(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Entrenamiento"
        description="Conversá con tu empleado para enseñarle información nueva, corregir respuestas o actualizar políticas y objetivos."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="rounded-2xl border border-border bg-card p-6">
          <TrainingChat mode="continuous" plan={plan} onProposalApplied={setPlan} />
        </div>
        <TrainingPlanStatus plan={plan} loading={loadingPlan} onResume={resumeSection} resumingKey={resumingKey} />
      </div>
    </div>
  );
}
