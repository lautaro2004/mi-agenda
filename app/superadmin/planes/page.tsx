"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Circle, Pencil, Plus } from "lucide-react";

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
  maxServices: number | null;
  publicWebEnabled: boolean;
  whatsappEnabled: boolean;
  depositsEnabled: boolean;
  customTrainingEnabled: boolean;
  statsEnabled: boolean;
  galleryEnabled: boolean;
  digitalMenuEnabled: boolean;
  active: boolean;
  businessCount: number;
  mercadoPagoPlanId: string | null;
  mercadoPagoSyncStatus: string | null;
  mercadoPagoLastSyncedAt: string | null;
  mercadoPagoSyncError: string | null;
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Columna "Mercado Pago" (sección 15 del pedido): nunca debe poder leerse
// como "conectado" si mercadoPagoSyncStatus no es exactamente "synced" — un
// plan pago sin sincronizar todavía y uno con error se muestran distinto a
// propósito, para que Superadmin nunca crea que un plan está conectado sin
// estarlo.
function MercadoPagoStatusCell({ plan }: { plan: PlanWithUsage }) {
  if (plan.monthlyPrice <= 0) {
    return <span className="text-xs text-muted-foreground">No aplica</span>;
  }

  if (plan.mercadoPagoSyncStatus === "synced" && plan.mercadoPagoPlanId) {
    return (
      <div className="flex flex-col gap-1">
        <Badge variant="outline" className="w-fit gap-1 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-3" />
          Conectado
        </Badge>
        <p className="font-mono text-[11px] text-muted-foreground" title={plan.mercadoPagoPlanId}>
          {plan.mercadoPagoPlanId.slice(0, 18)}…
        </p>
        {plan.mercadoPagoLastSyncedAt && (
          <p className="text-[11px] text-muted-foreground">
            {dateTimeFormatter.format(new Date(plan.mercadoPagoLastSyncedAt))}
          </p>
        )}
      </div>
    );
  }

  if (plan.mercadoPagoSyncStatus === "error") {
    return (
      <div className="flex flex-col gap-1">
        <Badge variant="outline" className="w-fit gap-1 border-destructive/30 text-destructive">
          <AlertTriangle className="size-3" />
          Error
        </Badge>
        {plan.mercadoPagoSyncError && (
          <p className="max-w-48 truncate text-[11px] text-destructive" title={plan.mercadoPagoSyncError}>
            {plan.mercadoPagoSyncError}
          </p>
        )}
      </div>
    );
  }

  return (
    <Badge variant="outline" className="w-fit gap-1 text-muted-foreground">
      <Circle className="size-3" />
      No conectado
    </Badge>
  );
}

const FEATURE_LABEL: Record<
  "publicWebEnabled" | "whatsappEnabled" | "depositsEnabled" | "customTrainingEnabled" | "statsEnabled" | "galleryEnabled" | "digitalMenuEnabled",
  string
> = {
  publicWebEnabled: "Web pública",
  whatsappEnabled: "WhatsApp + IA",
  depositsEnabled: "Señas",
  customTrainingEnabled: "Entrenamiento",
  statsEnabled: "Estadísticas",
  galleryEnabled: "Galería",
  digitalMenuEnabled: "Carta + QR",
};

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

  // El plan de Nexo se guarda igual pase lo que pase con Mercado Pago (ver
  // syncPlanWithMercadoPago) — pero si el sync falló, hay que decírselo a
  // Superadmin en vez de un genérico "Plan creado/actualizado" que sugiera
  // que todo salió bien (sección 2/15 del pedido).
  function notifyPlanSaved(plan: PlanWithUsage, savedLabel: string) {
    if (plan.mercadoPagoSyncStatus === "error") {
      toast.warning(`${savedLabel}, pero no se pudo sincronizar con Mercado Pago: ${plan.mercadoPagoSyncError ?? "error desconocido"}`);
    } else {
      toast.success(savedLabel);
    }
  }

  async function handleCreate(values: PlanFormValues) {
    try {
      const { plan } = await requestJson<{ plan: PlanWithUsage }>("/api/superadmin/planes", {
        method: "POST",
        body: JSON.stringify(values),
      });
      notifyPlanSaved(plan, "Plan creado");
      loadPlans();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos crear el plan.");
    }
  }

  async function handleUpdate(id: string, values: PlanFormValues) {
    try {
      const { plan } = await requestJson<{ plan: PlanWithUsage }>(`/api/superadmin/planes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      notifyPlanSaved(plan, "Plan actualizado");
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
              <th className="px-4 py-3 font-medium">Funcionalidades</th>
              <th className="px-4 py-3 font-medium">Empresas</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Mercado Pago</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="px-4 py-3" colSpan={8}>
                    <Skeleton className="h-5 w-full" />
                  </td>
                </tr>
              ))
            ) : !plans || plans.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
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
                    {plan.monthlyPrice > 0 ? `${formatPrice(plan.monthlyPrice, plan.currency)} / mes` : "Nivel base"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{plan.aiCredits > 0 ? numberFormatter.format(plan.aiCredits) : "No incluye"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(Object.keys(FEATURE_LABEL) as (keyof typeof FEATURE_LABEL)[])
                        .filter((key) => plan[key])
                        .map((key) => (
                          <Badge key={key} variant="outline" className="text-[11px]">
                            {FEATURE_LABEL[key]}
                          </Badge>
                        ))}
                      {plan.maxServices !== null && (
                        <Badge variant="outline" className="text-[11px]">
                          Hasta {plan.maxServices} servicios
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <Link href={`/superadmin/empresas?plan=${plan.slug}`} className="underline-offset-2 hover:text-foreground hover:underline">
                      {numberFormatter.format(plan.businessCount)}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={plan.active ? "secondary" : "outline"}>{plan.active ? "Activo" : "Inactivo"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <MercadoPagoStatusCell plan={plan} />
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
