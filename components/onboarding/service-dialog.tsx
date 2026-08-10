"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { requestJson } from "@/lib/api-client";
import { serviceSchema, type ServiceFormInput, type ServiceFormValues } from "@/lib/schemas";
import { SERVICE_CATEGORIES, type Resource, type Service } from "@/lib/types";

interface ServiceDialogProps {
  trigger: React.ReactElement;
  service?: Service;
  onSubmit: (values: ServiceFormValues) => void;
}

export function ServiceDialog({ trigger, service, onSubmit }: ServiceDialogProps) {
  const [open, setOpen] = React.useState(false);

  // Recursos: solo tiene sentido configurarlos sobre un servicio que ya
  // existe (uno nuevo todavía no tiene id para vincular). Se cargan recién
  // al abrir el diálogo en modo edición, nunca al crear.
  const [usesResources, setUsesResources] = React.useState(false);
  const [allResources, setAllResources] = React.useState<Resource[] | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [savingResources, setSavingResources] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ServiceFormInput, unknown, ServiceFormValues>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name ?? "",
      description: service?.description ?? "",
      category: (service?.category || undefined) as ServiceFormInput["category"],
      durationMinutes: service?.durationMinutes ?? 30,
      price: service?.price ?? 0,
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({
        name: service?.name ?? "",
        description: service?.description ?? "",
        category: (service?.category || undefined) as ServiceFormInput["category"],
        durationMinutes: service?.durationMinutes ?? 30,
        price: service?.price ?? 0,
      });

      if (service) {
        setAllResources(null);
        Promise.all([
          requestJson<{ resources: Resource[] }>("/api/business/resources"),
          requestJson<{ resourceIds: string[] }>(`/api/business/services/${service.id}/resources`),
        ]).then(([{ resources }, { resourceIds }]) => {
          setAllResources(resources);
          setSelectedIds(resourceIds);
          setUsesResources(resourceIds.length > 0);
        });
      }
    }
  }

  function toggleResource(id: string, checked: boolean) {
    setSelectedIds((prev) => (checked ? [...prev, id] : prev.filter((r) => r !== id)));
  }

  async function submit(values: ServiceFormValues) {
    onSubmit(values);

    if (service) {
      setSavingResources(true);
      try {
        await requestJson(`/api/business/services/${service.id}/resources`, {
          method: "PUT",
          body: JSON.stringify({ resourceIds: usesResources ? selectedIds : [] }),
        });
      } finally {
        setSavingResources(false);
      }
    }

    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
          <DialogDescription>
            Completá los datos del servicio que ofrecés a tus clientes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} id="service-form">
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="service-name">Nombre</FieldLabel>
              <Input
                id="service-name"
                placeholder="Ej: Corte de cabello"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.category}>
              <FieldLabel htmlFor="service-category">Categoría</FieldLabel>
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="service-category" className="w-full" aria-invalid={!!errors.category}>
                      <SelectValue placeholder="Seleccioná una categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.category]} />
            </Field>

            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="service-description">Descripción</FieldLabel>
              <Textarea
                id="service-description"
                placeholder="Detalles del servicio (opcional)"
                rows={3}
                aria-invalid={!!errors.description}
                {...register("description")}
              />
              <FieldError errors={[errors.description]} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.durationMinutes}>
                <FieldLabel htmlFor="service-duration">Duración (min)</FieldLabel>
                <Input
                  id="service-duration"
                  type="number"
                  min={5}
                  step={5}
                  aria-invalid={!!errors.durationMinutes}
                  {...register("durationMinutes")}
                />
                <FieldError errors={[errors.durationMinutes]} />
              </Field>

              <Field data-invalid={!!errors.price}>
                <FieldLabel htmlFor="service-price">Precio</FieldLabel>
                <Input
                  id="service-price"
                  type="number"
                  min={0}
                  step="0.01"
                  aria-invalid={!!errors.price}
                  {...register("price")}
                />
                <FieldError errors={[errors.price]} />
              </Field>
            </div>

            {service && (
              <Field>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
                  <div>
                    <FieldLabel htmlFor="service-uses-resources">Este servicio utiliza recursos</FieldLabel>
                    <FieldDescription>
                      Ej: varias canchas o salas que pueden reservarse al mismo tiempo.
                    </FieldDescription>
                  </div>
                  <Switch
                    id="service-uses-resources"
                    checked={usesResources}
                    onCheckedChange={setUsesResources}
                    disabled={allResources === null}
                    aria-label="Este servicio utiliza recursos"
                  />
                </div>

                {usesResources && (
                  <div className="mt-2 space-y-1.5 rounded-lg border border-border p-3">
                    {allResources === null ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        Cargando recursos…
                      </p>
                    ) : allResources.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Todavía no creaste recursos. Podés hacerlo desde &ldquo;Recursos&rdquo; en el menú.
                      </p>
                    ) : (
                      allResources.map((resource) => (
                        <label key={resource.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedIds.includes(resource.id)}
                            onCheckedChange={(checked) => toggleResource(resource.id, !!checked)}
                          />
                          {resource.name}
                          {!resource.active && (
                            <span className="text-xs text-muted-foreground">(inactivo)</span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
                )}
              </Field>
            )}
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="service-form" disabled={savingResources}>
            {savingResources && <Loader2 className="size-4 animate-spin" data-icon="inline-start" />}
            {service ? "Guardar cambios" : "Agregar servicio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
