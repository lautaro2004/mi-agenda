"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { memoryEntrySchema, type MemoryEntryFormValues } from "@/lib/schemas";
import { MEMORY_CATEGORIES, MEMORY_IMPORTANCE_LEVELS, MEMORY_IMPORTANCE_META, type MemoryEntry } from "@/lib/types";

interface MemoryEntryDialogProps {
  trigger: React.ReactElement;
  entry?: MemoryEntry;
  onSubmit: (values: MemoryEntryFormValues) => void;
}

export function MemoryEntryDialog({ trigger, entry, onSubmit }: MemoryEntryDialogProps) {
  const [open, setOpen] = React.useState(false);

  const defaults: MemoryEntryFormValues = {
    title: entry?.title ?? "",
    content: entry?.content ?? "",
    category: (entry?.category || "Otro") as MemoryEntryFormValues["category"],
    importance: entry?.importance ?? "medium",
    active: entry?.active ?? true,
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<MemoryEntryFormValues>({
    resolver: zodResolver(memoryEntrySchema),
    defaultValues: defaults,
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(defaults);
  }

  function submit(values: MemoryEntryFormValues) {
    onSubmit(values);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? "Editar entrada" : "Nueva entrada de memoria"}</DialogTitle>
          <DialogDescription>
            Esta información se incluye automáticamente en las respuestas de tu empleado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} id="memory-entry-form">
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="memory-title">Título</FieldLabel>
              <Input
                id="memory-title"
                placeholder="Ej: Política de cancelación"
                aria-invalid={!!errors.title}
                {...register("title")}
              />
              <FieldError errors={[errors.title]} />
            </Field>

            <Field data-invalid={!!errors.content}>
              <FieldLabel htmlFor="memory-content">Contenido</FieldLabel>
              <Textarea
                id="memory-content"
                placeholder="Escribí la información que tu empleado debe conocer"
                rows={4}
                aria-invalid={!!errors.content}
                {...register("content")}
              />
              <FieldError errors={[errors.content]} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errors.category}>
                <FieldLabel htmlFor="memory-category">Categoría</FieldLabel>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="memory-category" className="w-full" aria-invalid={!!errors.category}>
                        <SelectValue placeholder="Categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        {MEMORY_CATEGORIES.map((category) => (
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

              <Field>
                <FieldLabel htmlFor="memory-importance">Importancia</FieldLabel>
                <Controller
                  control={control}
                  name="importance"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="memory-importance" className="w-full">
                        <SelectValue placeholder="Importancia" />
                      </SelectTrigger>
                      <SelectContent>
                        {MEMORY_IMPORTANCE_LEVELS.map((level) => (
                          <SelectItem key={level} value={level}>
                            {MEMORY_IMPORTANCE_META[level].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="memory-active">Activa</FieldLabel>
              <Controller
                control={control}
                name="active"
                render={({ field }) => (
                  <Switch id="memory-active" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="memory-entry-form">
            {entry ? "Guardar cambios" : "Agregar entrada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
