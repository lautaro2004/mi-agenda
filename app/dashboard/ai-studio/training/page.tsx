"use client";

import * as React from "react";

import { PageHeader } from "@/components/dashboard/page-header";
import { TrainingChat } from "@/components/ai-studio/training-chat";
import { TrainingPlanStatus } from "@/components/ai-studio/training-plan-status";
import { requestJson } from "@/lib/api-client";
import type { TrainingPlan } from "@/lib/types";

export default function TrainingPage() {
  const [plan, setPlan] = React.useState<TrainingPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = React.useState(true);

  React.useEffect(() => {
    requestJson<{ plan: TrainingPlan | null }>("/api/ai-studio/training-plan")
      .then(({ plan }) => setPlan(plan))
      .catch(() => setPlan(null))
      .finally(() => setLoadingPlan(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Entrenamiento"
        description="Conversá con tu empleado para enseñarle información nueva, corregir respuestas o actualizar políticas y objetivos."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="rounded-2xl border border-border bg-card p-6">
          <TrainingChat mode="continuous" onProposalApplied={setPlan} />
        </div>
        <TrainingPlanStatus plan={plan} loading={loadingPlan} />
      </div>
    </div>
  );
}
