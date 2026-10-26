"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { CalendarClock, CheckCircle2 } from "lucide-react";

import { TrainingChat } from "@/components/ai-studio/training-chat";
import { TrainingPlanStatus } from "@/components/ai-studio/training-plan-status";
import { DocumentUploader } from "@/components/ai-studio/document-uploader";
import { Button } from "@/components/ui/button";
import { requestJson } from "@/lib/api-client";
import { useBusinessSubscription } from "@/lib/subscription-client";
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
  const router = useRouter();
  const { data: subscriptionData } = useBusinessSubscription();
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
  const [showCompletionCelebration, setShowCompletionCelebration] = React.useState(false);

  React.useEffect(() => {
    requestJson<{ plan: TrainingPlan | null }>("/api/ai-studio/training-plan")
      .then(({ plan }) => setPlan(plan))
      .catch(() => setPlan(null))
      .finally(() => setLoadingPlan(false));

    requestJson<{ schedule: BusinessSchedule }>("/api/business")
      .then(({ schedule }) => setScheduleConfigured(schedule.some((day) => day.enabled)))
      .catch(() => setScheduleConfigured(null));
  }, []);

  // El entrenamiento por chat es la IA de WhatsApp: solo lo incluyen
  // Profesional y Empresa. Un negocio en Agenda interna o Esencial configura
  // todo con el formulario, sin pasar por acá.
  const aiIncluded = (subscriptionData?.subscription?.effectivePlan ?? subscriptionData?.subscription?.plan)?.customTrainingEnabled ?? true;
  React.useEffect(() => {
    if (!aiIncluded) router.replace("/onboarding/negocio");
  }, [aiIncluded, router]);

  const readyToContinue = isMinimumTrainingComplete(plan);
  const pendingSections = plan?.sections.filter((s) => s.status === "pending" || s.status === "in_progress") ?? [];

  // Festeja y avanza solo en una transición EN VIVO durante esta sesión (el
  // último tema se cerró recién, con el dueño mirando) — no cuando el plan
  // ya estaba completo desde antes de que esta pantalla cargara (ej. volvió
  // acá con el back del navegador): ahí no hay nada que celebrar, solo se
  // muestra el estado resuelto tal cual.
  const planInitializedRef = React.useRef(false);
  const wasReadyRef = React.useRef(false);

  React.useEffect(() => {
    if (!plan) return;

    if (!planInitializedRef.current) {
      planInitializedRef.current = true;
      wasReadyRef.current = readyToContinue;
      return;
    }

    if (readyToContinue && !wasReadyRef.current) {
      wasReadyRef.current = true;
      setShowCompletionCelebration(true);
      const timeout = setTimeout(() => router.push("/onboarding/suscripcion"), 1900);
      return () => clearTimeout(timeout);
    }

    if (!readyToContinue) {
      wasReadyRef.current = false;
    }
  }, [plan, readyToContinue, router]);

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

  // "Continuar" con temas pendientes: se marcan para después (quedan
  // visibles en AI Studio) y recién ahí se avanza — antes había dos salidas
  // distintas ("Continuar →" y "Terminar configuración por ahora") que no
  // dejaban claro qué pasaba con lo que faltaba.
  async function continueLater() {
    setSkipping(true);
    try {
      await requestJson<{ plan: TrainingPlan | null }>("/api/ai-studio/training-plan/skip-remaining", { method: "POST" });
      toast.success("Listo. Lo que falta queda guardado en AI Studio para retomarlo cuando quieras.");
      router.push("/onboarding/suscripcion");
    } catch {
      toast.error("No pudimos actualizar el plan. Intentá de nuevo.");
      setSkipping(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Contratá y entrená a tu empleado</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Contale a la IA cómo funciona tu negocio, como se lo contarías a alguien nuevo. Ella arma la configuración
          y vos confirmás cada cambio antes de que se guarde.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
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

      <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <Link href="/onboarding/negocio" className="text-muted-foreground hover:text-foreground hover:underline">
          Prefiero completar un formulario
        </Link>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          {!readyToContinue && pendingSections.length > 0 && (
            <span className="text-xs text-muted-foreground sm:text-right">
              {pendingSections.length === 1 ? "Falta 1 tema" : `Faltan ${pendingSections.length} temas`}: podés completarlos ahora o más tarde desde AI Studio.
            </span>
          )}
          {!readyToContinue && pendingSections.length > 0 ? (
            <Button type="button" variant="outline" onClick={() => void continueLater()} disabled={skipping}>
              {skipping ? "Guardando…" : "Continuar y completar después"}
            </Button>
          ) : (
            <Button render={<Link href="/onboarding/suscripcion" />} nativeButton={false}>
              Continuar →
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCompletionCelebration && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center shadow-lg"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.15, type: "spring" }}
                className="flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2 className="size-9" />
              </motion.div>
              <h2 className="text-lg font-semibold text-foreground">¡Listo! Tu negocio ya está configurado.</h2>
              <p className="text-sm text-muted-foreground">Te llevamos al siguiente paso...</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
