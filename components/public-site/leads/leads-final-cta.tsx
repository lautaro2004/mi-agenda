import { ArrowUp, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

// Cierre de la plantilla de captación: vuelve al formulario del hero (único
// formulario de la página — no se duplica) o abre WhatsApp.
export function LeadsFinalCta({ whatsappHref }: { whatsappHref: string | null }) {
  return (
    <section className="bg-gradient-to-b from-[var(--brand-primary,var(--primary))]/[0.07] to-transparent px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
          ¿Arrancamos?
        </h2>
        <p className="mx-auto mt-3.5 max-w-md text-base text-muted-foreground">
          Dejanos tus datos y te contactamos para contarte todo.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            size="lg"
            className="h-12 bg-[var(--brand-primary,var(--primary))] px-7 text-base hover:bg-[var(--brand-primary,var(--primary))]/90"
            render={<a href="#contacto" />}
            nativeButton={false}
          >
            <ArrowUp className="size-4" data-icon="inline-start" />
            Quiero que me contacten
          </Button>
          {whatsappHref && (
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-7 text-base"
              render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
            >
              <MessageCircle className="size-4" data-icon="inline-start" />
              WhatsApp
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
