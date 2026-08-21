"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2 } from "lucide-react";

import { TrainingChat } from "@/components/ai-studio/training-chat";
import { TrainingPlanStatus } from "@/components/ai-studio/training-plan-status";
import { DocumentUploader } from "@/components/ai-studio/document-uploader";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api-client";
import type { BusinessSchedule, MemoryEntry, TrainingPlan } from "@/lib/types";

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
  const [skipping, setSkipping] = React.useState(false);
  const [resumingKey, setResumingKey] = React.useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = React.useState<MemoryEntry[]>([]);
  const [uploadingCount, setUploadingCount] = React.useState(0);
  // Horarios vive en su propia tabla (Schedule) y su propia pantalla, aparte
  // de todo lo que entrena la IA — este estado solo refleja si ya se
  // configuró o no, para mostrar el CTA correcto. No pasa por el chat.
  const [scheduleConfigured, setScheduleConfigured] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    requestJson<{ plan: TrainingPlan | null }>("/api/ai-studio/training-plan")
      .then(({ plan }) => setPlan(plan))
      .catch(() => setPlan(null))
      .finally(() => setLoadingPlan(false));

    requestJson<{ schedule: BusinessSchedule }>("/api/business")
      .then(({ schedule }) => setScheduleConfigured(schedule.some((day) => day.enabled)))
      .catch(() => setScheduleConfigured(null));
  }, []);

  const readyToContinue = isMinimumTrainingComplete(plan);
  const pendingSections = plan?.sections.filter((s) => s.status === "pending" || s.status === "in_progress") ?? [];

  async function resumeSection(key: string) {
    setResumingKey(key);
    try {
      const { plan: updated } = await requestJson<{ plan: TrainingPlan | null }>(
        `/api/ai-studio/training-plan/${encodeURIComponent(key)}/resume`,
        { method: "POST" }
      );
      setPlan(updated);
    } catch {
      toast.error("No pudimos activar esa sección. Intentá de nuevo.");
    } finally {
      setResumingKey(null);
    }
  }

  async function skipRemaining() {
    setSkipping(true);
    try {
      const { plan: updated } = await requestJson<{ plan: TrainingPlan | null }>(
        "/api/ai-studio/training-plan/skip-remaining",
        { method: "POST" }
      );
      setPlan(updated);
      toast.success("Listo, podés continuar. Retomá lo que falte cuando quieras desde AI Studio.");
    } catch {
      toast.error("No pudimos actualizar el plan. Intentá de nuevo.");
    } finally {
      setSkipping(false);
    }
  }

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
        <TrainingChat mode="onboarding" plan={plan} onProposalApplied={setPlan} />
        <div className="space-y-4">
          <TrainingPlanStatus plan={plan} loading={loadingPlan} onResume={resumeSection} resumingKey={resumingKey} />

          {plan && (
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold text-foreground">Configuración del negocio</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Esto no se conversa con la IA: tiene su propia pantalla.
              </p>

              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  {scheduleConfigured ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  Horarios de atención
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={scheduleConfigured ? "outline" : "default"}
                  render={<Link href="/onboarding/horarios?from=training" />}
                  nativeButton={false}
                >
                  {scheduleConfigured ? "Editar" : "Configurar →"}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold text-foreground">Recursos de conocimiento</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              ¿Tenés documentos que puedan ayudar a tu empleado a responder mejor?
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Podés subir manuales, listas de precios, políticas, catálogos o documentación de tu negocio.
            </p>

            <div className="mt-3">
              <DocumentUploader
                onUploaded={(entry) => setUploadedDocs((prev) => [entry, ...prev])}
                onUploadingChange={setUploadingCount}
              />
            </div>

            {uploadedDocs.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {uploadedDocs.map((doc) => (
                  <li key={doc.id} className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    {doc.title}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {uploadingCount > 0 && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
          Algunos recursos todavía se están subiendo. Esperá a que termine antes de salir para no perder esa
          subida — los que ya terminaron quedan guardados igual.
        </div>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
        <Link href="/onboarding/negocio" className="text-muted-foreground hover:text-foreground hover:underline">
          Prefiero completar un formulario
        </Link>

        <Link href="/onboarding/suscripcion" className="font-medium text-primary hover:underline">
          Continuar →
        </Link>
      </div>

      {!readyToContinue && pendingSections.length > 0 && (
        <div className="mt-3 flex flex-col items-end gap-2 text-right">
          <p className="text-xs text-muted-foreground">
            Todavía faltan: {pendingSections.map((s) => s.title).join(", ")}. Podés seguir charlando con la IA, o
            continuar igual y retomarlas después desde AI Studio.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void skipRemaining()} disabled={skipping}>
            Terminar configuración por ahora
          </Button>
        </div>
      )}
    </div>
  );
}
