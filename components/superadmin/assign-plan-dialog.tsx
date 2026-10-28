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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PlanPairFields, type AdminPlanOption } from "@/components/superadmin/plan-pair-fields";
import { requestJson } from "@/lib/api-client";
import { assignSubscriptionSchema, type AssignSubscriptionValues } from "@/lib/schemas";
import { BILLING_SUBSCRIPTION_STATUSES, type BillingSubscriptionStatus } from "@/lib/types";

const STATUS_LABEL: Record<BillingSubscriptionStatus, string> = {
  trialing: "Prueba",
  active: "Activa",
  past_due: "Pago vencido",
  canceled: "Cancelada",
  expired: "Expirada",
};

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

interface AssignPlanDialogProps {
  trigger: React.ReactElement;
  businessId: string;
  current: {
    planId: string | null;
    status: BillingSubscriptionStatus | "none";
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
  };
  onAssigned: () => void;
}

// Único punto para crear/actualizar la Subscription de un negocio desde
// Superadmin — sección 10 del pedido: sin checkout, solo asignación manual
// para testing/admin interno. Como Subscription.businessId es único en la
// base, el server siempre hace upsert (ver /api/superadmin/empresas/[id]/subscription).
export function AssignPlanDialog({ trigger, businessId, current, onAssigned }: AssignPlanDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [plans, setPlans] = React.useState<AdminPlanOption[] | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const defaults: AssignSubscriptionValues = {
    planId: "",
    crmPlanId: "",
    status: current.status === "none" ? "active" : current.status,
    currentPeriodStart: toDateInputValue(current.currentPeriodStart) || new Date().toISOString().slice(0, 10),
    currentPeriodEnd: toDateInputValue(current.currentPeriodEnd),
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AssignSubscriptionValues>({
    resolver: zodResolver(assignSubscriptionSchema),
    defaultValues: defaults,
  });

  const nexoPlanId = watch("planId") ?? "";
  const crmPlanId = watch("crmPlanId") ?? "";

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset(defaults);
      requestJson<{ plans: AdminPlanOption[] }>("/api/superadmin/planes")
        .then(({ plans }) => setPlans(plans))
        .catch(() => setPlans([]));
    }
  }

  async function submit(values: AssignSubscriptionValues) {
    setSubmitting(true);
    try {
      await requestJson(`/api/superadmin/empresas/${businessId}/subscription`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      setOpen(false);
      onAssigned();
    } catch {
      // El form queda abierto — el toast de error lo maneja el caller si hace falta.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar plan</DialogTitle>
          <DialogDescription>
            Asignación manual — todavía no hay checkout de Mercado Pago. Elegí el plan de Nexo, el de Nodo o
            ambos: lo que no elijas se mantiene.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} id="assign-plan-form">
          <FieldGroup>
            <PlanPairFields
              plans={plans}
              nexoPlanId={nexoPlanId}
              crmPlanId={crmPlanId}
              onNexoChange={(id) => setValue("planId", id, { shouldValidate: true })}
              onCrmChange={(id) => setValue("crmPlanId", id, { shouldValidate: true })}
              includeBase
              includeInactive
              error={errors.planId}
            />

            <Field data-invalid={!!errors.status}>
              <FieldLabel htmlFor="assign-status">Estado</FieldLabel>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v as BillingSubscriptionStatus)}>
                    <SelectTrigger id="assign-status" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BILLING_SUBSCRIPTION_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.status]} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={!!errors.currentPeriodStart}>
                <FieldLabel htmlFor="assign-start">Inicio del período</FieldLabel>
                <Input id="assign-start" type="date" aria-invalid={!!errors.currentPeriodStart} {...register("currentPeriodStart")} />
                <FieldError errors={[errors.currentPeriodStart]} />
              </Field>

              <Field data-invalid={!!errors.currentPeriodEnd}>
                <FieldLabel htmlFor="assign-end">Fin del período (opcional)</FieldLabel>
                <Input id="assign-end" type="date" aria-invalid={!!errors.currentPeriodEnd} {...register("currentPeriodEnd")} />
                <FieldError errors={[errors.currentPeriodEnd]} />
              </Field>
            </div>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="assign-plan-form" disabled={submitting}>
            {submitting ? "Guardando..." : "Asignar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
