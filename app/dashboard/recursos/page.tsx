"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Boxes, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/dashboard/page-header";
import { DeleteIconButton } from "@/components/dashboard/delete-icon-button";
import { ResourceDialog } from "@/components/dashboard/resource-dialog";
import { requestJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { ResourceFormValues } from "@/lib/schemas";
import type { Resource } from "@/lib/types";

export default function ResourcesPage() {
  const [resources, setResources] = React.useState<Resource[] | null>(null);
  const [loadError, setLoadError] = React.useState(false);
  const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    requestJson<{ resources: Resource[] }>("/api/business/resources")
      .then(({ resources }) => setResources(resources))
      .catch(() => {
        setLoadError(true);
        toast.error("No pudimos cargar los recursos.");
      });
  }, []);

  function setItemDeleting(id: string, pending: boolean) {
    setDeletingIds((prev) => {
      const next = new Set(prev);
      if (pending) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function addResource(values: ResourceFormValues) {
    try {
      const { resource } = await requestJson<{ resource: Resource }>("/api/business/resources", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setResources((prev) => [...(prev ?? []), resource]);
      toast.success("Recurso agregado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos agregar el recurso.");
    }
  }

  async function editResource(id: string, values: ResourceFormValues) {
    try {
      const { resource } = await requestJson<{ resource: Resource }>(`/api/business/resources/${id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      setResources((prev) => prev?.map((r) => (r.id === id ? resource : r)) ?? prev);
      toast.success("Recurso actualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar el recurso.");
    }
  }

  async function toggleActive(resource: Resource) {
    const previous = resources;
    setResources((prev) => prev?.map((r) => (r.id === resource.id ? { ...r, active: !r.active } : r)) ?? prev);
    try {
      await requestJson(`/api/business/resources/${resource.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !resource.active }),
      });
    } catch {
      setResources(previous);
      toast.error("No pudimos actualizar el recurso.");
    }
  }

  async function removeResource(id: string) {
    // No optimista: si tiene historial de turnos, el servidor lo desactiva
    // en vez de borrarlo — necesitamos su respuesta para saber cuál pasó
    // antes de tocar el estado local.
    try {
      const { result } = await requestJson<{ ok: boolean; result: "deleted" | "deactivated" }>(
        `/api/business/resources/${id}`,
        { method: "DELETE" }
      );
      if (result === "deleted") {
        setResources((prev) => prev?.filter((r) => r.id !== id) ?? prev);
        toast.success("Recurso eliminado");
      } else {
        setResources((prev) => prev?.map((r) => (r.id === id ? { ...r, active: false } : r)) ?? prev);
        toast.success("Este recurso tiene turnos asociados, así que lo desactivamos en vez de eliminarlo.");
      }
    } catch {
      toast.error("No pudimos eliminar el recurso.");
    }
  }

  return (
    <div>
      <PageHeader
        title="Recursos"
        description="Canchas, salas, sillas o cualquier cosa que se pueda reservar por separado dentro de un mismo servicio."
        action={
          <ResourceDialog
            onSubmit={addResource}
            trigger={
              <Button>
                <Plus className="size-4" data-icon="inline-start" />
                Agregar
              </Button>
            }
          />
        }
      />

      {loadError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          No pudimos cargar los recursos. Recargá la página para volver a intentar.
        </div>
      ) : resources === null ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Boxes className="size-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">Todavía no agregaste recursos</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Si tus servicios funcionan con la agenda general (ej. un solo turno a la vez), no necesitás
            configurar nada acá.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {resources.map((resource) => (
              <motion.div
                key={resource.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4",
                  deletingIds.has(resource.id) && "pointer-events-none opacity-50"
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{resource.name}</p>
                    <Badge variant={resource.active ? "secondary" : "outline"}>
                      {resource.active ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  {resource.description && (
                    <p className="mt-0.5 text-sm text-muted-foreground">{resource.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch
                    checked={resource.active}
                    onCheckedChange={() => void toggleActive(resource)}
                    aria-label={`Activar o desactivar: ${resource.name}`}
                    size="sm"
                  />
                  <ResourceDialog
                    resource={resource}
                    onSubmit={(values) => editResource(resource.id, values)}
                    trigger={
                      <Button variant="ghost" size="icon-sm" aria-label={`Editar: ${resource.name}`}>
                        <Pencil className="size-3.5" />
                      </Button>
                    }
                  />
                  <DeleteIconButton
                    label={`Eliminar: ${resource.name}`}
                    onPendingChange={(pending) => setItemDeleting(resource.id, pending)}
                    onDelete={() => removeResource(resource.id)}
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
