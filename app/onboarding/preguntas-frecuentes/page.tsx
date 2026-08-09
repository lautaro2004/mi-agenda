"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircleQuestion, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FaqDialog } from "@/components/onboarding/faq-dialog";
import { StepActions } from "@/components/onboarding/step-actions";
import { useOnboarding } from "@/lib/onboarding-store";

export default function FaqsStepPage() {
  const router = useRouter();
  const { state, addFaq, updateFaq, removeFaq, setStep } = useOnboarding();

  function handleContinue() {
    setStep(5);
    router.push("/onboarding/suscripcion");
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Preguntas frecuentes
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Anticipá las dudas más comunes de tus clientes. La IA usará estas
            respuestas en futuras versiones.
          </p>
        </div>

        <FaqDialog
          onSubmit={(values) => addFaq(values).catch(() => toast.error("No pudimos agregar la pregunta."))}
          trigger={
            <Button>
              <Plus className="size-4" data-icon="inline-start" />
              Agregar
            </Button>
          }
        />
      </div>

      {state.faqs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <MessageCircleQuestion className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            Todavía no agregaste preguntas frecuentes
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Este paso es opcional, pero te recomendamos agregar al menos una.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {state.faqs.map((faq) => (
              <motion.div
                key={faq.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{faq.question}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{faq.answer}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <FaqDialog
                      faq={faq}
                      onSubmit={(values) =>
                        updateFaq(faq.id, values).catch(() =>
                          toast.error("No pudimos actualizar la pregunta.")
                        )
                      }
                      trigger={
                        <Button variant="ghost" size="icon-sm">
                          <Pencil className="size-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      onClick={() =>
                        removeFaq(faq.id).catch(() => toast.error("No pudimos eliminar la pregunta."))
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <StepActions
        backHref="/onboarding/servicios"
        onNext={handleContinue}
        nextLabel="Continuar"
      />
    </div>
  );
}
