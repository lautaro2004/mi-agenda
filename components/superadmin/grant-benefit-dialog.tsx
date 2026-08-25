"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { requestJson } from "@/lib/api-client";
import { grantBenefitSchema, type GrantBenefitValues } from "@/lib/schemas";

interface PlanOption {
  id: string;
  slug: string;
  name: string;
  active: boolean;
}

const DURATION_PRESETS = [
  { months: 1, label: "1 mes" },
  { months: 3, label: "3 meses" },
  { months: 6, label: "6 meses" },
];
const CUSTOM_DATE = "custom";

function addMonths(date: Date, months: number): string {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

interface GrantBenefitDialogProps {
  trigger: React.ReactElement;
  businessId: string;
  businessName: string;
  onGranted: () => void;
}

// Bonificación temporal (sección 1 del pedido): solo Esencial/Profesional —
// nunca Gratis, "regalar" el plan gratuito no es una bonificación. Reutiliza
// el mismo endpoint de planes que assign-plan-dialog.tsx (GET
// /api/superadmin/planes), un solo fetch de planes para todo Superadmin.
export function GrantBenefitDialog({ trigger, businessId, businessName, onGranted }: GrantBenefitDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [plans, setPlans] = React.useState<PlanOption[] | null>(null);
  const [durationMode, setDurationMode] = React.useState<string>("1");
  const [submitting, setSubmitting] = React.useState(false);

  const defaults: GrantBenefitValues = { planId: "", expiresAt: addMonths(new Date(), 1) };

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GrantBenefitValues>({
    resolver: zodResolver(grantBenefitSchema),
    defaultValues: defaults,
  });

  const expiresAt = watch("expiresAt");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset(defaults);
      setDurationMode("1");
      requestJson<{ plans: PlanOption[] }>("/api/superadmin/planes")
        .then(({ plans }) => setPlans(plans.filter((p) => p.active && p.slug !== "gratis")))
        .catch(() => setPlans([]));
    }
  }

  function handleDurationChange(value: string | null) {
    if (!value) return;
    setDurationMode(value);
    if (value !== CUSTOM_DATE) {
      setValue("expiresAt", addMonths(new Date(), Number(value)), { shouldValidate: true });
    }
  }

  async function submit(values: GrantBenefitValues) {
    setSubmitting(true);
    try {
      await requestJson(`/api/superadmin/empresas/${businessId}/benefit`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      setOpen(false);
      onGranted();
    } catch {
      // El form queda abierto — mismo criterio que assign-plan-dialog.tsx.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Otorgar plan temporal</DialogTitle>
          <DialogDescription>
            {businessName} pasa a ese plan de inmediato. Al vencer, vuelve solo al plan que tenía antes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} id="grant-benefit-form">
          <FieldGroup>
            <Field data-invalid={!!errors.planId}>
              <FieldLabel htmlFor="benefit-plan">Plan</FieldLabel>
              <Controller
                control={control}
                name="planId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                    <SelectTrigger id="benefit-plan" className="w-full" aria-invalid={!!errors.planId}>
                      <SelectValue placeholder={plans === null ? "Cargando..." : "Elegí un plan"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(plans ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.planId]} />
            </Field>

            <Field data-invalid={!!errors.expiresAt}>
              <FieldLabel htmlFor="benefit-duration">Duración</FieldLabel>
              <Select value={durationMode} onValueChange={handleDurationChange}>
                <SelectTrigger id="benefit-duration" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_PRESETS.map((p) => (
                    <SelectItem key={p.months} value={String(p.months)}>
                      {p.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_DATE}>Fecha personalizada</SelectItem>
                </SelectContent>
              </Select>
              {durationMode === CUSTOM_DATE && (
                <Input id="benefit-duration-date" type="date" className="mt-2" aria-invalid={!!errors.expiresAt} {...register("expiresAt")} />
              )}
              <FieldDescription>
                {durationMode !== CUSTOM_DATE && expiresAt && `Vence el ${new Date(`${expiresAt}T00:00:00`).toLocaleDateString("es-AR")}`}
              </FieldDescription>
              <FieldError errors={[errors.expiresAt]} />
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="grant-benefit-form" disabled={submitting}>
            {submitting ? "Otorgando..." : "Otorgar plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
