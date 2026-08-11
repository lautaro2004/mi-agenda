"use client";

import { ArrowRight, CheckCircle2, Circle, Loader2, MinusCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { TrainingPlan } from "@/lib/types";

interface TrainingPlanStatusProps {
  plan: TrainingPlan | null;
  loading: boolean;
  // Opcional: quien la pase habilita "Completar {sección} →" en Pendientes/
  // Omitidas — activa esa sección puntual (ver activateSection) para
  // retomarla desde acá sin tener que esperar a que la IA la ofrezca sola.
  onResume?: (key: string) => void;
  resumingKey?: string | null;
}

// Componente controlado: el dueño del fetch es la página (para poder
// actualizar el estado al instante con la respuesta de /training/apply, sin
// una segunda ida y vuelta al servidor cada vez que se guarda una sección).
export function TrainingPlanStatus({ plan, loading, onResume, resumingKey }: TrainingPlanStatusProps) {
  if (loading) {
    return <div className="h-40 animate-pulse rounded-2xl border border-border bg-muted/30" />;
  }

  if (!plan) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        Todavía no armamos un plan de entrenamiento. En cuanto le cuentes a tu empleado a qué se dedica el
        negocio, la IA va a proponer uno a medida.
      </div>
    );
  }

  const inProgress = plan.sections.filter((s) => s.status === "in_progress");
  const completed = plan.sections.filter((s) => s.status === "completed");
  const pending = plan.sections.filter((s) => s.status === "pending");
  const ignored = plan.sections.filter((s) => s.status === "ignored");

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Plan de entrenamiento</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Para tu rubro: {plan.category}. Nunca está &ldquo;completo&rdquo; del todo — siempre podés enseñarle algo
        nuevo.
      </p>

      {inProgress.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">En progreso</p>
          <ul className="mt-1.5 space-y-1">
            {inProgress.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-sm font-medium text-foreground">
                <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-amber-600 dark:text-amber-400" />
                {s.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {completed.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Completadas</p>
          <ul className="mt-1.5 space-y-1">
            {completed.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {s.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Pendientes</p>
          <ul className="mt-1.5 space-y-1.5">
            {pending.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-2 text-sm text-foreground" title={s.description}>
                <span className="flex items-start gap-2">
                  <Circle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  {s.title}
                </span>
                {onResume && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
                    disabled={resumingKey === s.key}
                    onClick={() => onResume(s.key)}
                  >
                    Completar
                    <ArrowRight className="size-3" data-icon="inline-end" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {ignored.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground">Omitidas</p>
          <ul className="mt-1.5 space-y-1.5">
            {ignored.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-2 text-sm text-muted-foreground/70">
                <span className="flex items-start gap-2">
                  <MinusCircle className="mt-0.5 size-3.5 shrink-0" />
                  {s.title}
                </span>
                {onResume && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
                    disabled={resumingKey === s.key}
                    onClick={() => onResume(s.key)}
                  >
                    Completar
                    <ArrowRight className="size-3" data-icon="inline-end" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
