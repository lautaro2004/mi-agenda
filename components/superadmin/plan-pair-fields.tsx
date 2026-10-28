"use client";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BASE_PLAN_SLUG } from "@/lib/types";

export interface AdminPlanOption {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  products?: string[];
  comboDiscountPct?: number | null;
}

const KEEP = "__keep";

// Los combos son planes internos (los crea el sistema): no se eligen a mano,
// se forman solos cuando se elige un plan de Nexo y uno de Nodo.
export function splitPlanOptions(plans: AdminPlanOption[], opts: { includeBase: boolean; includeInactive: boolean }) {
  const usable = plans.filter((p) => p.comboDiscountPct == null && (opts.includeInactive || p.active));
  const crm = usable.filter((p) => p.products?.length === 1 && p.products[0] === "crm" && p.active);
  const nexo = usable.filter((p) => !crm.includes(p) && (opts.includeBase || p.slug !== BASE_PLAN_SLUG));
  return { nexo, crm };
}

interface PlanPairFieldsProps {
  plans: AdminPlanOption[] | null;
  nexoPlanId: string;
  crmPlanId: string;
  onNexoChange: (id: string) => void;
  onCrmChange: (id: string) => void;
  includeBase: boolean;
  includeInactive: boolean;
  error?: { message?: string } | undefined;
}

// Nexo y Nodo se asignan por separado: elegir uno no quita el otro. Si el
// negocio queda con los dos, se activa el combo y se ven ambos planes.
export function PlanPairFields({ plans, nexoPlanId, crmPlanId, onNexoChange, onCrmChange, includeBase, includeInactive, error }: PlanPairFieldsProps) {
  const { nexo, crm } = splitPlanOptions(plans ?? [], { includeBase, includeInactive });
  const nameOf = (list: AdminPlanOption[], id: string, fallback: string) => list.find((p) => p.id === id)?.name ?? fallback;

  return (
    <>
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="plan-nexo">Plan de Nexo</FieldLabel>
        <Select value={nexoPlanId || KEEP} onValueChange={(v) => onNexoChange(!v || v === KEEP ? "" : v)}>
          <SelectTrigger id="plan-nexo" className="w-full">
            <SelectValue>{nexoPlanId ? nameOf(nexo, nexoPlanId, "Plan") : plans === null ? "Cargando..." : "No cambiar"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={KEEP}>No cambiar</SelectItem>
            {nexo.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
                {!p.active ? " (inactivo)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="plan-crm">Plan de Nodo</FieldLabel>
        <Select value={crmPlanId || KEEP} onValueChange={(v) => onCrmChange(!v || v === KEEP ? "" : v)}>
          <SelectTrigger id="plan-crm" className="w-full">
            <SelectValue>{crmPlanId ? nameOf(crm, crmPlanId, "Plan") : plans === null ? "Cargando..." : "No cambiar"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={KEEP}>No cambiar</SelectItem>
            {crm.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldDescription>
          Elegí uno o los dos. Lo que no elijas se mantiene como está: si queda con Nexo y Nodo, se ven ambos activos (combo).
        </FieldDescription>
        <FieldError errors={[error]} />
      </Field>
    </>
  );
}
