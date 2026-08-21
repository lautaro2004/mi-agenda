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

interface PlanOption {
  id: string;
  name: string;
  active: boolean;
}

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
  const [plans, setPlans] = React.useState<PlanOption[] | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const defaults: AssignSubscriptionValues = {
    planId: current.planId ?? "",
    status: current.status === "none" ? "active" : current.status,
    currentPeriodStart: toDateInputValue(current.currentPeriodStart) || new Date().toISOString().slice(0, 10),
    currentPeriodEnd: toDateInputValue(current.currentPeriodEnd),
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<AssignSubscriptionValues>({
    resolver: zodResolver(assignSubscriptionSchema),
    defaultValues: defaults,
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset(defaults);
      requestJson<{ plans: PlanOption[] }>("/api/superadmin/planes")
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
            Asignación manual — todavía no hay checkout de Mercado Pago. Reemplaza cualquier suscripción existente de
            este negocio.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} id="assign-plan-form">
          <FieldGroup>
            <Field data-invalid={!!errors.planId}>
              <FieldLabel htmlFor="assign-plan">Plan</FieldLabel>
              <Controller
                control={control}
                name="planId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                    <SelectTrigger id="assign-plan" className="w-full" aria-invalid={!!errors.planId}>
                      <SelectValue placeholder={plans === null ? "Cargando..." : "Elegí un plan"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(plans ?? []).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                          {!p.active ? " (inactivo)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.planId]} />
            </Field>

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
