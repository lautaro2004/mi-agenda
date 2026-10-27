"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Circle, Pencil, Plus } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PlanDialog, type PlanOption } from "@/components/superadmin/plan-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requestJson } from "@/lib/api-client";
import { tierWarnings, type SeatTier } from "@/lib/billing-seats";
import { formatMoney, offerKind, packSavingsFor, type PackSavings } from "@/lib/billing-pricing";
import type { PlanFormValues } from "@/lib/schemas";

interface PriceRow {
  id: string;
  interval: "month" | "year";
  amount: number;
  currency: string;
  active: boolean;
  mercadoPagoPlanId: string | null;
  mercadoPagoSyncStatus: string | null;
  mercadoPagoLastSyncedAt: string | null;
  mercadoPagoSyncError: string | null;
}

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
  smartBookingEnabled?: boolean;
  webAiChatEnabled?: boolean;
  active: boolean;
  businessCount: number;
  mercadoPagoPlanId: string | null;
  mercadoPagoSyncStatus: string | null;
  mercadoPagoLastSyncedAt: string | null;
  mercadoPagoSyncError: string | null;
  products: string[];
  crmMaxUsers: number | null;
  extraUserMonthlyPrice: number | null;
  extraUserYearlyPrice: number | null;
  trialDays: number | null;
  displayOrder: number;
  packNexoPlanId: string | null;
  packCrmPlanId: string | null;
  prices: PriceRow[];
}

const dateTimeFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

// Estado de sincronización de UN precio con Mercado Pago. Nunca debe poder
// leerse como "conectado" si mercadoPagoSyncStatus no es exactamente
// "synced": sin sincronizar y con error se muestran distinto a propósito.
function SyncBadge({ price }: { price: Pick<PriceRow, "mercadoPagoPlanId" | "mercadoPagoSyncStatus" | "mercadoPagoLastSyncedAt" | "mercadoPagoSyncError"> }) {
  if (price.mercadoPagoSyncStatus === "synced" && price.mercadoPagoPlanId) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400" title={price.mercadoPagoPlanId}>
        <CheckCircle2 className="size-3" />
        Sincronizado
        {price.mercadoPagoLastSyncedAt && (
          <span className="text-muted-foreground"> · {dateTimeFormatter.format(new Date(price.mercadoPagoLastSyncedAt))}</span>
        )}
      </span>
    );
  }
  if (price.mercadoPagoSyncStatus === "reference") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-sky-700 dark:text-sky-400" title="Se cobra en pesos al dólar oficial al contratar">
        <CheckCircle2 className="size-3" />
        Referencia USD · se cobra en pesos
      </span>
    );
  }
  if (price.mercadoPagoSyncStatus === "error") {
    return (
      <span className="inline-flex max-w-56 items-center gap-1 truncate text-[11px] text-destructive" title={price.mercadoPagoSyncError ?? ""}>
        <AlertTriangle className="size-3 shrink-0" />
        Error: {price.mercadoPagoSyncError ?? "desconocido"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
      <Circle className="size-3" />
      No conectado
    </span>
  );
}

function PriceCell({ plan }: { plan: PlanWithUsage }) {
  if (plan.monthlyPrice <= 0 && !plan.prices.some((p) => p.interval === "year" && p.active)) {
    return <span className="text-muted-foreground">Nivel base</span>;
  }
  // El mensual siempre se lee del Plan (su preapproval_plan de siempre); el
  // anual, de su PlanPrice.
  const yearly = plan.prices.find((p) => p.interval === "year");
  return (
    <div className="space-y-1.5">
      {plan.monthlyPrice > 0 && (
        <div>
          <p className="text-foreground">{formatMoney(plan.monthlyPrice, plan.currency)} / mes</p>
          <SyncBadge price={plan} />
        </div>
      )}
      {yearly && (
        <div className={yearly.active ? undefined : "opacity-60"}>
          <p className="text-foreground">
            {formatMoney(yearly.amount, yearly.currency)} / año{!yearly.active && " (inactivo)"}
          </p>
          {/* Un precio desactivado no se vende: no mostrar errores viejos de sincronización. */}
          {yearly.active && <SyncBadge price={yearly} />}
        </div>
      )}
    </div>
  );
}

function SavingsLine({ label, savings }: { label: string; savings: PackSavings }) {
  if (savings.status === "unavailable") {
    return (
      <p className="text-[11px] text-muted-foreground">
        {label}: sin comparar (falta precio {savings.missing.map((m) => (m === "crm" ? "de Nodo" : m === "nexo" ? "de Nexo" : "del pack")).join(", ")})
      </p>
    );
  }
  if (savings.status === "more_expensive") {
    return (
      <p className="flex items-center gap-1 text-[11px] font-medium text-destructive">
        <AlertTriangle className="size-3" />
        {label}: el pack cuesta más que contratar los dos por separado ({formatMoney(savings.individualTotal)})
      </p>
    );
  }
  if (savings.status === "no_discount") {
    return <p className="text-[11px] text-amber-700 dark:text-amber-400">{label}: sin descuento (igual a la suma individual)</p>;
  }
  return (
    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
      {label}: ahorra {formatMoney(savings.savings)} ({savings.percent.toLocaleString("es-AR")}%) vs {formatMoney(savings.individualTotal)}
    </p>
  );
}

const FEATURE_LABEL: Record<
  "publicWebEnabled" | "whatsappEnabled" | "depositsEnabled" | "customTrainingEnabled" | "statsEnabled" | "galleryEnabled" | "digitalMenuEnabled" | "smartBookingEnabled" | "webAiChatEnabled",
  string
> = {
  publicWebEnabled: "Web pública",
  whatsappEnabled: "WhatsApp + IA",
  depositsEnabled: "Señas",
  customTrainingEnabled: "Entrenamiento",
  statsEnabled: "Estadísticas",
  galleryEnabled: "Galería",
  digitalMenuEnabled: "Carta + QR",
  smartBookingEnabled: "Agenda inteligente",
  webAiChatEnabled: "Chat web IA",
};

const numberFormatter = new Intl.NumberFormat("es-AR");

const SECTIONS: { kind: "nexo" | "crm" | "pack"; title: string; hint: string }[] = [
  { kind: "nexo", title: "Nexo", hint: "Presencia digital, atención y automatización." },
  { kind: "crm", title: "Nodo", hint: "CRM. Nodo no tiene plan gratuito; quien contrata solo Nodo conserva el gratuito de Nexo." },
  { kind: "pack", title: "Pack Nexo + Nodo", hint: "Una sola suscripción que habilita los dos productos. El ahorro se calcula contra sus planes de referencia." },
];

// Avisos de solapamiento entre planes de Nodo + usuarios extra (mensual y
// anual por separado). Ver lib/billing-seats.ts.
function crmTierWarnings(plans: PlanWithUsage[]): string[] {
  const crm = plans.filter((p) => p.active && offerKind(p.products) === "crm" && p.crmMaxUsers);
  const monthly: SeatTier[] = crm
    .filter((p) => p.monthlyPrice > 0)
    .map((p) => ({ name: p.name, users: p.crmMaxUsers!, price: p.monthlyPrice, extraUserPrice: p.extraUserMonthlyPrice }));
  const yearly: SeatTier[] = crm.flatMap((p) => {
    const price = p.prices.find((x) => x.interval === "year" && x.active);
    return price ? [{ name: p.name, users: p.crmMaxUsers!, price: price.amount, extraUserPrice: p.extraUserYearlyPrice }] : [];
  });
  return [...tierWarnings(monthly).map((m) => `Mensual: ${m}`), ...tierWarnings(yearly).map((m) => `Anual: ${m}`)];
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

  const byId = React.useMemo(() => new Map((plans ?? []).map((p) => [p.id, p])), [plans]);
  const planOptions: PlanOption[] = (plans ?? []).map((p) => ({ id: p.id, name: p.name, products: p.products }));

  // El plan se guarda igual pase lo que pase con Mercado Pago (ver
  // syncPlanWithMercadoPago) — si el sync del mensual o del anual falló,
  // se avisa en vez de un "guardado" genérico.
  function notifyPlanSaved(plan: PlanWithUsage, savedLabel: string) {
    const yearlyError = plan.prices?.find((p) => p.interval === "year" && p.mercadoPagoSyncStatus === "error");
    if (plan.mercadoPagoSyncStatus === "error") {
      toast.warning(`${savedLabel}, pero no se pudo sincronizar el precio mensual con Mercado Pago: ${plan.mercadoPagoSyncError ?? "error desconocido"}`);
    } else if (yearlyError) {
      toast.warning(`${savedLabel}, pero no se pudo sincronizar el precio anual con Mercado Pago: ${yearlyError.mercadoPagoSyncError ?? "error desconocido"}`);
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
    if (plan.active && plan.businessCount > 0 && !window.confirm(`¿Desactivar "${plan.name}"? No afecta a las ${plan.businessCount} empresas que ya lo tienen; solo deja de ofrecerse.`)) {
      return;
    }
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

  function renderRow(plan: PlanWithUsage) {
    const kind = offerKind(plan.products);
    const nexoRef = plan.packNexoPlanId ? (byId.get(plan.packNexoPlanId) ?? null) : null;
    const crmRef = plan.packCrmPlanId ? (byId.get(plan.packCrmPlanId) ?? null) : null;
    return (
      <tr key={plan.id} className="border-b border-border align-top last:border-0 hover:bg-muted/40">
        <td className="px-4 py-3">
          <p className="font-medium text-foreground">{plan.name}</p>
          <p className="text-xs text-muted-foreground">{plan.slug}</p>
          {plan.trialDays ? <p className="mt-1 text-[11px] text-muted-foreground">Prueba: {plan.trialDays} días</p> : null}
        </td>
        <td className="px-4 py-3">
          <PriceCell plan={plan} />
          {kind === "pack" && (
            <div className="mt-2 space-y-0.5">
              {nexoRef && crmRef ? (
                <>
                  <SavingsLine label="Mensual" savings={packSavingsFor(plan, nexoRef, crmRef, "month")} />
                  <SavingsLine label="Anual" savings={packSavingsFor(plan, nexoRef, crmRef, "year")} />
                  <p className="text-[11px] text-muted-foreground">
                    vs {nexoRef.name} + {crmRef.name}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">Elegí los planes de referencia para calcular el ahorro.</p>
              )}
            </div>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {plan.products.includes("nexo") &&
              (Object.keys(FEATURE_LABEL) as (keyof typeof FEATURE_LABEL)[])
                .filter((key) => plan[key])
                .map((key) => (
                  <Badge key={key} variant="outline" className="text-[11px]">
                    {FEATURE_LABEL[key]}
                  </Badge>
                ))}
            {plan.products.includes("nexo") && (
              <Badge variant="outline" className="text-[11px]">
                {plan.aiCredits > 0 ? `${numberFormatter.format(plan.aiCredits)} créditos IA` : "Sin IA"}
              </Badge>
            )}
            {plan.products.includes("nexo") && plan.maxServices !== null && (
              <Badge variant="outline" className="text-[11px]">
                Hasta {plan.maxServices} servicios
              </Badge>
            )}
            {plan.products.includes("crm") && (
              <Badge variant="outline" className="text-[11px]">
                Nodo · {plan.crmMaxUsers ?? "?"} usuarios
              </Badge>
            )}
            {plan.products.includes("crm") && plan.extraUserMonthlyPrice !== null && (
              <Badge variant="outline" className="text-[11px]">
                +{formatMoney(plan.extraUserMonthlyPrice, plan.currency)} por usuario extra
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
          <div className="flex items-center justify-end gap-2">
            <PlanDialog
              plan={plan}
              allPlans={planOptions}
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
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planes"
        description="Planes de Nexo, de Nodo y el pack: productos, precios mensual y anual, límites y prueba gratuita."
        action={
          <PlanDialog
            allPlans={planOptions}
            trigger={
              <Button size="sm">
                <Plus className="size-4" data-icon="inline-start" />
                Nuevo plan
              </Button>
            }
            onSubmit={handleCreate}
          />
        }
      />

      {loading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : !plans || plans.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Todavía no hay planes creados.
        </p>
      ) : (
        SECTIONS.map((section) => {
          const rows = plans.filter((p) => offerKind(p.products) === section.kind);
          const tierIssues = section.kind === "crm" ? crmTierWarnings(plans) : [];
          return (
            <section key={section.kind} className="space-y-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
                <p className="text-xs text-muted-foreground">{section.hint}</p>
              </div>
              {tierIssues.length > 0 && (
                <ul className="space-y-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
                  {tierIssues.map((message) => (
                    <li key={message}>⚠ {message}</li>
                  ))}
                </ul>
              )}
              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Plan</th>
                      <th className="px-4 py-3 font-medium">Precio y Mercado Pago</th>
                      <th className="px-4 py-3 font-medium">Incluye</th>
                      <th className="px-4 py-3 font-medium">Empresas</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td className="px-4 py-6 text-center text-muted-foreground" colSpan={6}>
                          Todavía no hay planes de este tipo.
                        </td>
                      </tr>
                    ) : (
                      rows.map(renderRow)
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}

      <p className="text-xs text-muted-foreground">
        Un plan con empresas asignadas no se puede eliminar — solo desactivar. Desactivarlo impide asignarlo a nuevas
        empresas, pero no afecta a quienes ya lo tienen. Cambiar un precio crea un plan nuevo en Mercado Pago para las
        próximas contrataciones; quienes ya pagan siguen con el anterior.
      </p>
    </div>
  );
}
