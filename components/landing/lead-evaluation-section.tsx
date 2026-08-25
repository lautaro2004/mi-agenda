"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ClipboardCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { LeadForm } from "@/components/landing/lead-form";

// Sección 1 del pedido: "¿Todavía no sabés si Nexo es para vos?" — a
// propósito después de LandingPricing en app/page.tsx (quien todavía duda
// después de ver precios es exactamente a quién le habla esto). El
// formulario vive en un Dialog (mismo primitive que el resto de la app,
// components/ui/dialog.tsx) para no navegar a una página nueva.
export function LandingLeadEvaluationSection() {
  const [open, setOpen] = React.useState(false);
  const [result, setResult] = React.useState<{ wantsMeeting: boolean } | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setResult(null);
  }

  return (
    <section className="px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="mx-auto flex max-w-3xl flex-col items-center gap-5 rounded-3xl border border-border bg-card px-6 py-14 text-center sm:px-12"
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ClipboardCheck className="size-6" />
        </span>
        <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
          ¿Todavía no sabés si Nexo es para vos?
        </h2>
        <p className="max-w-xl text-muted-foreground">
          Contanos un poco sobre tu negocio y qué querés mejorar. Te mostramos cómo podrías usar Nexo y qué plan
          tiene más sentido para vos.
        </p>

        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger
            render={
              <Button size="lg" className="h-11 px-7 text-base">
                Quiero una evaluación
              </Button>
            }
          />
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
            {result ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <CheckCircle2 className="size-10 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-lg font-semibold text-foreground">¡Gracias! Recibimos tu información.</h3>
                <p className="text-sm text-muted-foreground">Vamos a revisar tu caso y nos pondremos en contacto.</p>
                {result.wantsMeeting && (
                  <p className="text-sm font-medium text-foreground">Te contactaremos para coordinar una reunión.</p>
                )}
                <Button variant="outline" className="mt-2" onClick={() => setOpen(false)}>
                  Cerrar
                </Button>
              </div>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Contanos sobre tu negocio</DialogTitle>
                </DialogHeader>
                <LeadForm onSuccess={(wantsMeeting) => setResult({ wantsMeeting })} />
              </>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </section>
  );
}
