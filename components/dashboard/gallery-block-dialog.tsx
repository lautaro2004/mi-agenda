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
import { galleryBlockSchema, type GalleryBlockFormValues } from "@/lib/schemas";
import type { GalleryBlock } from "@/lib/types";

interface GalleryBlockDialogProps {
  trigger: React.ReactElement;
  block?: GalleryBlock;
  onSubmit: (values: GalleryBlockFormValues) => void;
}

// Título y descripción son opcionales (sección 1 de la tarea: un bloque
// puede ser solo fotos) — mismo patrón de diálogo único crear/editar que
// components/onboarding/service-dialog.tsx.
export function GalleryBlockDialog({ trigger, block, onSubmit }: GalleryBlockDialogProps) {
  const [open, setOpen] = React.useState(false);

  const defaults: GalleryBlockFormValues = {
    title: block?.title ?? "",
    description: block?.description ?? "",
  };

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GalleryBlockFormValues>({
    resolver: zodResolver(galleryBlockSchema),
    defaultValues: defaults,
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(defaults);
  }

  function submit(values: GalleryBlockFormValues) {
    onSubmit(values);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{block ? "Editar bloque" : "Nuevo bloque"}</DialogTitle>
          <DialogDescription>
            Un título y una descripción cortos para presentar estas fotos — los dos son opcionales.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} id="gallery-block-form">
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="gallery-block-title">Título</FieldLabel>
              <Input id="gallery-block-title" placeholder="Ej: Nuestros platos" {...register("title")} />
              <FieldError errors={[errors.title]} />
            </Field>

            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="gallery-block-description">Descripción</FieldLabel>
              <Textarea
                id="gallery-block-description"
                rows={2}
                placeholder="Ej: Una selección de nuestros platos más destacados."
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
          <Button type="submit" form="gallery-block-form">
            {block ? "Guardar cambios" : "Crear bloque"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
