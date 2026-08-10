"use client";

import * as React from "react";
import { AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Plus, PackageOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ServiceDialog } from "@/components/onboarding/service-dialog";
import { ServiceCard } from "@/components/onboarding/service-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnboarding } from "@/lib/onboarding-store";

export default function ServicesSettingsPage() {
  const { state, hydrated, refresh, addService, updateService, removeService } = useOnboarding();

  // El estado de OnboardingProvider es una foto tomada al loguearse (vive en
  // la raíz de la app, no se remonta al navegar) — si el negocio se entrenó
  // por chat después de esa foto, acá seguía vacío. Al entrar a esta pantalla
  // pedimos el estado real de Postgres en vez de confiar en esa foto.
  React.useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="Servicios"
        description="Estos son los servicios que tus clientes podrán reservar por WhatsApp."
        action={
          <ServiceDialog
            onSubmit={async (values) => {
              try {
                await addService(values);
                toast.success("Servicio agregado");
              } catch {
                toast.error("No pudimos agregar el servicio. Intentá de nuevo.");
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

      {!hydrated ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      ) : state.services.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <PackageOpen className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Todavía no agregaste servicios</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Agregá tu primer servicio para que tus clientes puedan reservarlo.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {state.services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onEdit={async (values) => {
                  try {
                    await updateService(service.id, values);
                    toast.success("Servicio actualizado");
                  } catch {
                    toast.error("No pudimos actualizar el servicio. Intentá de nuevo.");
                  }
                }}
                onDelete={async () => {
                  try {
                    await removeService(service.id);
                    toast.success("Servicio eliminado");
                  } catch {
                    toast.error("No pudimos eliminar el servicio. Intentá de nuevo.");
                  }
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
