"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { planSchema, type PlanFormInput, type PlanFormValues } from "@/lib/schemas";

interface PlanLike {
  name: string;
  slug: string;
  description: string | null;
  monthlyPrice: number;
  currency: string;
  aiCredits: number;
  active: boolean;
}

interface PlanDialogProps {
  trigger: React.ReactElement;
  plan?: PlanLike;
  onSubmit: (values: PlanFormValues) => void;
}

// Mismo patrón que components/ai-studio/memory-entry-dialog.tsx: un único
// diálogo sirve para crear y editar (plan presente = editar).
export function PlanDialog({ trigger, plan, onSubmit }: PlanDialogProps) {
  const [open, setOpen] = React.useState(false);

  const defaults: PlanFormInput = {
    name: plan?.name ?? "",
    slug: plan?.slug ?? "",
    description: plan?.description ?? "",
    monthlyPrice: plan?.monthlyPrice ?? 0,
    currency: plan?.currency ?? "ARS",
    aiCredits: plan?.aiCredits ?? 40,
    active: plan?.active ?? true,
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PlanFormInput, unknown, PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: defaults,
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(defaults);
  }

  function submit(values: PlanFormValues) {
    onSubmit(values);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{plan ? "Editar plan" : "Nuevo plan"}</DialogTitle>
          <DialogDescription>
            aiCredits es la cantidad de respuestas de IA permitidas, no tokens.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} id="plan-form">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="plan-name">Nombre</FieldLabel>
                <Input id="plan-name" placeholder="Business" aria-invalid={!!errors.name} {...register("name")} />
                <FieldError errors={[errors.name]} />
              </Field>

              <Field data-invalid={!!errors.slug}>
                <FieldLabel htmlFor="plan-slug">Slug</FieldLabel>
                <Input id="plan-slug" placeholder="business" aria-invalid={!!errors.slug} {...register("slug")} />
                <FieldError errors={[errors.slug]} />
              </Field>
            </div>

            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="plan-description">Descripción</FieldLabel>
              <Textarea id="plan-description" rows={2} {...register("description")} />
              <FieldError errors={[errors.description]} />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field data-invalid={!!errors.monthlyPrice}>
                <FieldLabel htmlFor="plan-price">Precio mensual</FieldLabel>
                <Input
                  id="plan-price"
                  type="number"
                  step="0.01"
                  min="0"
                  aria-invalid={!!errors.monthlyPrice}
                  {...register("monthlyPrice")}
                />
                <FieldError errors={[errors.monthlyPrice]} />
              </Field>

              <Field data-invalid={!!errors.currency}>
                <FieldLabel htmlFor="plan-currency">Moneda</FieldLabel>
                <Input id="plan-currency" placeholder="ARS" aria-invalid={!!errors.currency} {...register("currency")} />
                <FieldError errors={[errors.currency]} />
              </Field>

              <Field data-invalid={!!errors.aiCredits}>
                <FieldLabel htmlFor="plan-credits">Créditos IA</FieldLabel>
                <Input
                  id="plan-credits"
                  type="number"
                  min="1"
                  aria-invalid={!!errors.aiCredits}
                  {...register("aiCredits")}
                />
                <FieldError errors={[errors.aiCredits]} />
              </Field>
            </div>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="plan-active">Activo</FieldLabel>
              <Controller
                control={control}
                name="active"
                render={({ field }) => <Switch id="plan-active" checked={field.value} onCheckedChange={field.onChange} />}
              />
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="plan-form">
            {plan ? "Guardar cambios" : "Crear plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
