"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { resourceSchema, type ResourceFormValues } from "@/lib/schemas";
import type { Resource } from "@/lib/types";

interface ResourceDialogProps {
  trigger: React.ReactElement;
  resource?: Resource;
  onSubmit: (values: ResourceFormValues) => Promise<void>;
}

export function ResourceDialog({ trigger, resource, onSubmit }: ResourceDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceSchema),
    defaultValues: { name: resource?.name ?? "", description: resource?.description ?? "" },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset({ name: resource?.name ?? "", description: resource?.description ?? "" });
    }
  }

  async function submit(values: ResourceFormValues) {
    setSubmitting(true);
    try {
      await onSubmit(values);
      setOpen(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{resource ? "Editar recurso" : "Nuevo recurso"}</DialogTitle>
          <DialogDescription>
            Ej: una cancha, una sala, una silla — cualquier cosa reservable por separado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} id="resource-form">
          <FieldGroup>
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="resource-name">Nombre</FieldLabel>
              <Input
                id="resource-name"
                placeholder="Ej: Cancha 1"
                aria-invalid={!!errors.name}
                {...register("name")}
              />
              <FieldError errors={[errors.name]} />
            </Field>

            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="resource-description">Descripción</FieldLabel>
              <Textarea
                id="resource-description"
                placeholder="Opcional"
                rows={2}
                aria-invalid={!!errors.description}
                {...register("description")}
              />
              <FieldError errors={[errors.description]} />
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="resource-form" disabled={submitting}>
            {resource ? "Guardar cambios" : "Agregar recurso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
