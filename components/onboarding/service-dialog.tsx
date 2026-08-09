"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { serviceSchema, type ServiceFormInput, type ServiceFormValues } from "@/lib/schemas";
import { SERVICE_CATEGORIES, type Service } from "@/lib/types";

interface ServiceDialogProps {
  trigger: React.ReactElement;
  service?: Service;
  onSubmit: (values: ServiceFormValues) => void;
}

export function ServiceDialog({ trigger, service, onSubmit }: ServiceDialogProps) {
  const [open, setOpen] = React.useState(false);

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
    }
  }

  function submit(values: ServiceFormValues) {
    onSubmit(values);
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
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="service-form">
            {service ? "Guardar cambios" : "Agregar servicio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
