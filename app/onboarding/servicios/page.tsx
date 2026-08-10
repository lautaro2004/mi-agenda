"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Plus, PackageOpen } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ServiceDialog } from "@/components/onboarding/service-dialog";
import { ServiceCard } from "@/components/onboarding/service-card";
import { StepActions } from "@/components/onboarding/step-actions";
import { useOnboarding } from "@/lib/onboarding-store";

export default function ServicesStepPage() {
  const router = useRouter();
  const { state, addService, updateService, removeService, setStep } = useOnboarding();

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
          onSubmit={(values) => addService(values).catch(() => toast.error("No pudimos agregar el servicio."))}
          trigger={
            <Button>
              <Plus className="size-4" data-icon="inline-start" />
              Agregar
            </Button>
          }
        />
      </div>

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
