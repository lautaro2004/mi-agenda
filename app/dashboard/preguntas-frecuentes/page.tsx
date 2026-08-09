"use client";

import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { MessageCircleQuestion, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FaqDialog } from "@/components/onboarding/faq-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { useOnboarding } from "@/lib/onboarding-store";

export default function FaqsSettingsPage() {
  const { state, addFaq, updateFaq, removeFaq } = useOnboarding();

  return (
    <div>
      <PageHeader
        title="Preguntas frecuentes"
        description="Estas respuestas serán utilizadas por la IA para resolver dudas comunes de tus clientes."
        action={
          <FaqDialog
            onSubmit={async (values) => {
              try {
                await addFaq(values);
                toast.success("Pregunta agregada");
              } catch {
                toast.error("No pudimos agregar la pregunta. Intentá de nuevo.");
              }
            }}
            trigger={
              <Button>
                <Plus className="size-4" data-icon="inline-start" />
                Agregar
              </Button>
            }
          />
        }
      />

      {state.faqs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <MessageCircleQuestion className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">
            Todavía no agregaste preguntas frecuentes
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Agregá las dudas más comunes de tus clientes y sus respuestas.
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
                      onSubmit={async (values) => {
                        try {
                          await updateFaq(faq.id, values);
                          toast.success("Pregunta actualizada");
                        } catch {
                          toast.error("No pudimos actualizar la pregunta. Intentá de nuevo.");
                        }
                      }}
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Editar pregunta: ${faq.question}`}>
                          <Pencil className="size-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive"
                      onClick={async () => {
                        try {
                          await removeFaq(faq.id);
                          toast.success("Pregunta eliminada");
                        } catch {
                          toast.error("No pudimos eliminar la pregunta. Intentá de nuevo.");
                        }
                      }}
                      aria-label={`Eliminar pregunta: ${faq.question}`}
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
    </div>
  );
}
