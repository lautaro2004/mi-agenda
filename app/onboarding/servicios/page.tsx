"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Plus, PackageOpen, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ServiceDialog } from "@/components/onboarding/service-dialog";
import { ServiceCard } from "@/components/onboarding/service-card";
import { StepActions } from "@/components/onboarding/step-actions";
import { useOnboarding } from "@/lib/onboarding-store";
import { requestJson } from "@/lib/api-client";
import { getBookingIntent } from "@/lib/booking-intent";
import type { Business } from "@/lib/types";

// Punto de integración pedido en la sección 14 de la tarea: no automatiza
// toda la decisión, solo sugiere y deja que el dueño confirme. Se apoya en
// la misma heurística no frágil que ya resuelve la plantilla en el sitio
// público (getBookingIntent) — nunca duplica esa lógica.
function BookingTemplateSuggestion({ onApplied }: { onApplied: () => void }) {
  const [applying, setApplying] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  async function apply() {
    setApplying(true);
    try {
      await requestJson<{ business: Business }>("/api/business/site-template", {
        method: "PATCH",
        body: JSON.stringify({ siteTemplate: "booking" }),
      });
      toast.success("Listo, activamos la web orientada a reservas.");
      onApplied();
    } catch {
      toast.error("No pudimos activar la plantilla. Podés hacerlo después desde Sitio web.");
    } finally {
      setApplying(false);
    }
  }

  if (dismissed) return null;

  return (
    <div className="mb-6 flex flex-col items-start gap-3 rounded-xl border border-[var(--brand-primary,var(--primary))]/30 bg-[var(--brand-primary,var(--primary))]/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-[var(--brand-primary,var(--primary))]" />
        <p className="text-sm text-foreground">
          Por lo que nos contás, te conviene una web orientada a reservas: tus clientes van a poder elegir servicio,
          fecha y horario directo desde el sitio.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setDismissed(true)} disabled={applying}>
          Ahora no
        </Button>
        <Button type="button" size="sm" onClick={() => void apply()} disabled={applying}>
          Activar
        </Button>
      </div>
    </div>
  );
}

export default function ServicesStepPage() {
  const router = useRouter();
  const { state, addService, updateService, removeService, setStep, refresh } = useOnboarding();

  const suggestBookingTemplate =
    state.business.siteTemplate == null && getBookingIntent(state.services) === "booking";

  function handleContinue() {
    setStep(4);
    router.push("/onboarding/preguntas-frecuentes");
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Agregá tus servicios
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Estos servicios serán los que tus clientes podrán reservar por WhatsApp.
          </p>
        </div>

        <ServiceDialog
          onSubmit={(values) =>
            addService(values).catch((error) =>
              toast.error(error instanceof Error ? error.message : "No pudimos agregar el servicio.")
            )
          }
          trigger={
            <Button>
              <Plus className="size-4" data-icon="inline-start" />
              Agregar
            </Button>
          }
        />
      </div>

      {suggestBookingTemplate && <BookingTemplateSuggestion onApplied={() => void refresh()} />}

      {state.services.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <PackageOpen className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Todavía no agregaste servicios</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Agregá al menos un servicio para continuar.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <AnimatePresence>
            {state.services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onEdit={(values) =>
                  updateService(service.id, values).catch(() =>
                    toast.error("No pudimos actualizar el servicio.")
                  )
                }
                onDelete={async () => {
                  try {
                    await removeService(service.id);
                  } catch {
                    toast.error("No pudimos eliminar el servicio.");
                  }
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <StepActions
        backHref="/onboarding/horarios"
        onNext={handleContinue}
        nextLabel="Continuar"
        nextDisabled={state.services.length === 0}
      />
    </div>
  );
}
