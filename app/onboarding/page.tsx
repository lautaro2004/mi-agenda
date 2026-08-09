"use client";

import * as React from "react";
import Link from "next/link";

import { TrainingChat } from "@/components/ai-studio/training-chat";
import { TrainingPlanStatus } from "@/components/ai-studio/training-plan-status";
import { requestJson } from "@/lib/api-client";
import type { TrainingPlan } from "@/lib/types";

// Solo para el mensaje de aliento, no para bloquear la navegación: el
// seguimiento de secciones depende de que la IA etiquete cada propuesta
// correctamente, y eso nunca puede garantizarse al 100% — bloquear la única
// salida del onboarding en base a eso puede dejar a alguien sin poder entrar
// al panel (ver Feature 11 postmortem).
function isMinimumTrainingComplete(plan: TrainingPlan | null): boolean {
  if (!plan || plan.sections.length === 0) return false;
  return plan.sections.every((s) => s.status === "completed" || s.status === "ignored");
}

export default function OnboardingIndexPage() {
  const [plan, setPlan] = React.useState<TrainingPlan | null>(null);
  const [loadingPlan, setLoadingPlan] = React.useState(true);

  React.useEffect(() => {
    requestJson<{ plan: TrainingPlan | null }>("/api/ai-studio/training-plan")
      .then(({ plan }) => setPlan(plan))
      .catch(() => setPlan(null))
      .finally(() => setLoadingPlan(false));
  }, []);

  const readyToContinue = isMinimumTrainingComplete(plan);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Contratá y entrená a tu empleado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contale a la IA cómo funciona tu negocio y ella va a ir armando la configuración por vos. Podés
          confirmar cada cambio antes de guardarlo.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <TrainingChat mode="onboarding" onProposalApplied={setPlan} />
        <TrainingPlanStatus plan={plan} loading={loadingPlan} />
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
        <Link href="/onboarding/negocio" className="text-muted-foreground hover:text-foreground hover:underline">
          Prefiero completar un formulario
        </Link>

        <Link href="/onboarding/suscripcion" className="font-medium text-primary hover:underline">
          Continuar →
        </Link>
      </div>

      {!readyToContinue && (
        <p className="mt-2 text-right text-xs text-muted-foreground">
          Todavía quedan secciones del plan sin repasar — podés seguir charlando con la IA, o continuar igual y
          retomarlas después desde AI Studio.
        </p>
      )}
    </div>
  );
}
