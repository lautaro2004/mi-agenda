"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlanDialog } from "@/components/superadmin/plan-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";
import type { PlanFormValues } from "@/lib/schemas";

interface PlanWithUsage {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthlyPrice: number;
  currency: string;
  aiCredits: number;
  active: boolean;
  businessCount: number;
}

const numberFormatter = new Intl.NumberFormat("es-AR");

function formatPrice(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${numberFormatter.format(amount)}`;
  }
}

export default function SuperadminPlanesPage() {
  const [plans, setPlans] = React.useState<PlanWithUsage[] | null>(null);
  const [loading, setLoading] = React.useState(true);

  function loadPlans() {
    setLoading(true);
    requestJson<{ plans: PlanWithUsage[] }>("/api/superadmin/planes")
      .then(({ plans }) => setPlans(plans))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false));
  }

  React.useEffect(loadPlans, []);

  async function handleCreate(values: PlanFormValues) {
    try {
      await requestJson("/api/superadmin/planes", { method: "POST", body: JSON.stringify(values) });
      toast.success("Plan creado");
      loadPlans();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos crear el plan.");
    }
  }

  async function handleUpdate(id: string, values: PlanFormValues) {
    try {
      await requestJson(`/api/superadmin/planes/${id}`, { method: "PATCH", body: JSON.stringify(values) });
      toast.success("Plan actualizado");
      loadPlans();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar el plan.");
    }
  }

  async function toggleActive(plan: PlanWithUsage) {
    try {
      await requestJson(`/api/superadmin/planes/${plan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !plan.active }),
      });
      toast.success(plan.active ? "Plan desactivado" : "Plan activado");
      loadPlans();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos actualizar el plan.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planes"
        description="Definen el precio y el límite de IA que después se asigna a cada empresa desde su detalle."
        action={
          <PlanDialog trigger={<Button size="sm"><Plus className="size-4" data-icon="inline-start" />Nuevo plan</Button>} onSubmit={handleCreate} />
        }
      />

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Precio</th>
              <th className="px-4 py-3 font-medium">Créditos IA</th>
              <th className="px-4 py-3 font-medium">Empresas</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={6}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : !plans || plans.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={6}>
                  Todavía no hay planes creados.
                </td>
              </tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">{plan.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {plan.monthlyPrice > 0 ? `${formatPrice(plan.monthlyPrice, plan.currency)} / mes` : "Gratis"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{numberFormatter.format(plan.aiCredits)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{numberFormatter.format(plan.businessCount)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={plan.active ? "secondary" : "outline"}>{plan.active ? "Activo" : "Inactivo"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <PlanDialog
                        plan={plan}
                        trigger={
                          <Button size="icon-sm" variant="ghost" aria-label="Editar plan">
                            <Pencil className="size-3.5" />
                          </Button>
                        }
                        onSubmit={(values) => handleUpdate(plan.id, values)}
                      />
                      <Button size="sm" variant="outline" onClick={() => void toggleActive(plan)}>
                        {plan.active ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Un plan con empresas asignadas no se puede eliminar — solo desactivar. Desactivarlo impide asignarlo a nuevas
        empresas, pero no afecta a quienes ya lo tienen.
      </p>
    </div>
  );
}
