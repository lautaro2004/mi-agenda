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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { planSchema, type PlanFormInput, type PlanFormValues } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export interface PlanOption {
  id: string;
  name: string;
  products: string[];
}

type OfferKind = "nexo" | "crm" | "pack";
const KIND_PRODUCTS: Record<OfferKind, ("nexo" | "crm")[]> = { nexo: ["nexo"], crm: ["crm"], pack: ["nexo", "crm"] };
const KIND_LABEL: Record<OfferKind, { title: string; hint: string }> = {
  nexo: { title: "Nexo", hint: "Solo Nexo" },
  crm: { title: "Nodo", hint: "Solo el CRM" },
  pack: { title: "Pack", hint: "Nexo + Nodo, una suscripción" },
};
function kindOf(products: string[] | undefined): OfferKind {
  const p = products ?? ["nexo"];
  if (p.includes("nexo") && p.includes("crm")) return "pack";
  return p.includes("crm") ? "crm" : "nexo";
}

interface PlanLike {
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
  id?: string;
  products?: string[];
  crmMaxUsers?: number | null;
  extraUserMonthlyPrice?: number | null;
  extraUserYearlyPrice?: number | null;
  trialDays?: number | null;
  displayOrder?: number;
  packNexoPlanId?: string | null;
  packCrmPlanId?: string | null;
  prices?: { interval: string; amount: number; active: boolean }[];
}

interface PlanDialogProps {
  trigger: React.ReactElement;
  plan?: PlanLike;
  // Para elegir los planes de referencia del pack.
  allPlans?: PlanOption[];
  onSubmit: (values: PlanFormValues) => void;
}

// Mismo patrón que components/ai-studio/memory-entry-dialog.tsx: un único
// diálogo sirve para crear y editar (plan presente = editar).
export function PlanDialog({ trigger, plan, allPlans = [], onSubmit }: PlanDialogProps) {
  const [open, setOpen] = React.useState(false);

  const defaults: PlanFormInput = {
    name: plan?.name ?? "",
    slug: plan?.slug ?? "",
    description: plan?.description ?? "",
    monthlyPrice: plan?.monthlyPrice ?? 0,
    currency: plan?.currency === "USD" ? "USD" : "ARS",
    aiCredits: plan?.aiCredits ?? 0,
    maxServices: plan?.maxServices ?? null,
    publicWebEnabled: plan?.publicWebEnabled ?? true,
    whatsappEnabled: plan?.whatsappEnabled ?? true,
    depositsEnabled: plan?.depositsEnabled ?? true,
    customTrainingEnabled: plan?.customTrainingEnabled ?? true,
    statsEnabled: plan?.statsEnabled ?? true,
    galleryEnabled: plan?.galleryEnabled ?? true,
    digitalMenuEnabled: plan?.digitalMenuEnabled ?? true,
    active: plan?.active ?? true,
    products: (plan?.products as ("nexo" | "crm")[] | undefined) ?? ["nexo"],
    crmMaxUsers: plan?.crmMaxUsers ?? null,
    extraUserMonthlyPrice: plan?.extraUserMonthlyPrice ?? null,
    extraUserYearlyPrice: plan?.extraUserYearlyPrice ?? null,
    trialDays: plan?.trialDays ?? null,
    displayOrder: plan?.displayOrder ?? 0,
    packNexoPlanId: plan?.packNexoPlanId ?? null,
    packCrmPlanId: plan?.packCrmPlanId ?? null,
    yearlyPrice: plan?.prices?.find((p) => p.interval === "year" && p.active)?.amount ?? null,
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PlanFormInput, unknown, PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: defaults,
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) reset(defaults);
  }

  const products = (watch("products") as string[] | undefined) ?? ["nexo"];
  const kind = kindOf(products);
  const includesNexo = products.includes("nexo");
  const includesCrm = products.includes("crm");
  const [clientError, setClientError] = React.useState<string | null>(null);

  function chooseKind(next: OfferKind) {
    setValue("products", KIND_PRODUCTS[next], { shouldDirty: true });
    if (next !== "pack") {
      setValue("packNexoPlanId", null);
      setValue("packCrmPlanId", null);
    }
  }

  function submit(values: PlanFormValues) {
    // Misma regla que el servidor (validatePlanCommercial): un plan con Nodo
    // fija sus usuarios. El servidor lo vuelve a validar igual.
    if (values.products.includes("crm") && !values.crmMaxUsers) {
      setClientError("Un plan que incluye Nodo tiene que fijar cuántos usuarios incluye.");
      return;
    }
    setClientError(null);
    onSubmit({
      ...values,
      // Fuera de un pack no hay planes de referencia.
      ...(kind !== "pack" ? { packNexoPlanId: null, packCrmPlanId: null } : {}),
      // Un plan sin Nodo no tiene usuarios de Nodo.
      ...(!values.products.includes("crm") ? { crmMaxUsers: null, extraUserMonthlyPrice: null, extraUserYearlyPrice: null } : {}),
    });
    setOpen(false);
  }

  const nexoOnly = allPlans.filter((p) => p.id !== plan?.id && p.products.length === 1 && p.products[0] === "nexo");
  const crmOnly = allPlans.filter((p) => p.id !== plan?.id && p.products.length === 1 && p.products[0] === "crm");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{plan ? "Editar plan" : "Nuevo plan"}</DialogTitle>
          <DialogDescription>
            Los productos que incluye definen qué habilita el plan (nunca su nombre). Créditos IA = cantidad de respuestas
            de IA, no tokens.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} id="plan-form">
          <FieldGroup>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Tipo de oferta</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo de oferta">
                {(Object.keys(KIND_LABEL) as OfferKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => chooseKind(k)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      kind === k ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-foreground/30"
                    )}
                  >
                    <span className="block font-medium">{KIND_LABEL[k].title}</span>
                    <span className="block text-[11px]">{KIND_LABEL[k].hint}</span>
                  </button>
                ))}
              </div>
            </div>

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
                <select
                  id="plan-currency"
                  aria-invalid={!!errors.currency}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  {...register("currency")}
                >
                  <option value="ARS">ARS (pesos)</option>
                  <option value="USD">USD (referencia, se cobra en pesos)</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  En USD el precio es una referencia: al contratar se cobra en pesos al dólar oficial (BNA venta) y se reajusta en cada renovación.
                </p>
                <FieldError errors={[errors.currency]} />
              </Field>

              {/* Créditos de IA: solo aplican a Nexo. */}
              {includesNexo && (
              <Field data-invalid={!!errors.aiCredits}>
                <FieldLabel htmlFor="plan-credits">Créditos IA</FieldLabel>
                <Input
                  id="plan-credits"
                  type="number"
                  min="0"
                  aria-invalid={!!errors.aiCredits}
                  {...register("aiCredits")}
                />
                <FieldError errors={[errors.aiCredits]} />
              </Field>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field data-invalid={!!errors.yearlyPrice}>
                <FieldLabel htmlFor="plan-yearly">Precio anual</FieldLabel>
                <Controller
                  control={control}
                  name="yearlyPrice"
                  render={({ field }) => (
                    <Input
                      id="plan-yearly"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Sin anual"
                      value={typeof field.value === "number" ? field.value : ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  )}
                />
                <FieldError errors={[errors.yearlyPrice]} />
              </Field>
              <Field data-invalid={!!errors.trialDays}>
                <FieldLabel htmlFor="plan-trial">Prueba (días)</FieldLabel>
                <Controller
                  control={control}
                  name="trialDays"
                  render={({ field }) => (
                    <Input
                      id="plan-trial"
                      type="number"
                      min="0"
                      placeholder="Sin prueba"
                      value={typeof field.value === "number" ? field.value : ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  )}
                />
                <FieldError errors={[errors.trialDays]} />
              </Field>
              <Field data-invalid={!!errors.displayOrder}>
                <FieldLabel htmlFor="plan-order">Orden</FieldLabel>
                <Input id="plan-order" type="number" min="0" {...register("displayOrder")} />
                <FieldError errors={[errors.displayOrder]} />
              </Field>
            </div>
            <FieldDescription className="-mt-2">
              Anual: débito automático cada 12 meses (plan propio en Mercado Pago). Vacío = no se ofrece anual. Precio
              mensual 0 = no se ofrece mensual.
            </FieldDescription>

            {includesCrm && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">Nodo</p>
                <Field data-invalid={!!errors.crmMaxUsers} className="mt-2">
                  <FieldLabel htmlFor="plan-crm-users">Usuarios incluidos</FieldLabel>
                  <Controller
                    control={control}
                    name="crmMaxUsers"
                    render={({ field }) => (
                      <Input
                        id="plan-crm-users"
                        type="number"
                        min="1"
                        placeholder="Obligatorio"
                        value={typeof field.value === "number" ? field.value : ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                      />
                    )}
                  />
                  <FieldDescription>Límite fijo, validado en el servidor de Nodo.</FieldDescription>
                  <FieldError errors={[errors.crmMaxUsers]} />
                </Field>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  {([
                    ["extraUserMonthlyPrice", "Usuario extra (mensual)"],
                    ["extraUserYearlyPrice", "Usuario extra (anual)"],
                  ] as const).map(([name, label]) => (
                    <Field key={name}>
                      <FieldLabel htmlFor={`plan-${name}`}>{label}</FieldLabel>
                      <Controller
                        control={control}
                        name={name}
                        render={({ field }) => (
                          <Input
                            id={`plan-${name}`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Sin extras"
                            value={typeof field.value === "number" ? field.value : ""}
                            onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                          />
                        )}
                      />
                    </Field>
                  ))}
                </div>
                <FieldDescription>
                  Lo que suma cada usuario extra al plan, en la moneda del plan. Vacío = el plan no ofrece extras. Para que un plan chico con extras no salga más barato que el siguiente, la pantalla de planes avisa si los precios se solapan.
                </FieldDescription>
              </div>
            )}

            {kind === "pack" && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs font-medium text-muted-foreground">Comparar el pack contra</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Field>
                    <FieldLabel htmlFor="plan-pack-nexo">Plan de Nexo</FieldLabel>
                    <Controller
                      control={control}
                      name="packNexoPlanId"
                      render={({ field }) => (
                        <select
                          id="plan-pack-nexo"
                          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        >
                          <option value="">Elegí…</option>
                          {nexoOnly.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="plan-pack-crm">Plan de Nodo</FieldLabel>
                    <Controller
                      control={control}
                      name="packCrmPlanId"
                      render={({ field }) => (
                        <select
                          id="plan-pack-crm"
                          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                        >
                          <option value="">Elegí…</option>
                          {crmOnly.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                    />
                  </Field>
                </div>
                <FieldDescription className="mt-2">
                  El ahorro se calcula solo, con los precios guardados del mismo período (mensual con mensual, anual
                  con anual). Si a alguno le falta ese precio, no se muestra ahorro para ese período.
                </FieldDescription>
              </div>
            )}

            {includesNexo && (
            <Field data-invalid={!!errors.maxServices}>
              <FieldLabel htmlFor="plan-max-services">Máximo de servicios</FieldLabel>
              <Controller
                control={control}
                name="maxServices"
                render={({ field }) => (
                  <Input
                    id="plan-max-services"
                    type="number"
                    min="1"
                    placeholder="Sin límite"
                    value={typeof field.value === "number" ? field.value : ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                  />
                )}
              />
              <FieldDescription>Vacío = sin límite.</FieldDescription>
              <FieldError errors={[errors.maxServices]} />
            </Field>
            )}

            {includesNexo && (
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">Funcionalidades de Nexo</p>
              <div className="mt-2 space-y-2.5">
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="plan-web">Web pública</FieldLabel>
                  <Controller
                    control={control}
                    name="publicWebEnabled"
                    render={({ field }) => <Switch id="plan-web" checked={field.value} onCheckedChange={field.onChange} />}
                  />
                </Field>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="plan-whatsapp">WhatsApp</FieldLabel>
                  <Controller
                    control={control}
                    name="whatsappEnabled"
                    render={({ field }) => <Switch id="plan-whatsapp" checked={field.value} onCheckedChange={field.onChange} />}
                  />
                </Field>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="plan-deposits">Señas y comprobantes</FieldLabel>
                  <Controller
                    control={control}
                    name="depositsEnabled"
                    render={({ field }) => <Switch id="plan-deposits" checked={field.value} onCheckedChange={field.onChange} />}
                  />
                </Field>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="plan-training">Entrenamiento continuo de IA</FieldLabel>
                  <Controller
                    control={control}
                    name="customTrainingEnabled"
                    render={({ field }) => <Switch id="plan-training" checked={field.value} onCheckedChange={field.onChange} />}
                  />
                </Field>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="plan-stats">Estadísticas</FieldLabel>
                  <Controller
                    control={control}
                    name="statsEnabled"
                    render={({ field }) => <Switch id="plan-stats" checked={field.value} onCheckedChange={field.onChange} />}
                  />
                </Field>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="plan-gallery">Galería de fotos</FieldLabel>
                  <Controller
                    control={control}
                    name="galleryEnabled"
                    render={({ field }) => <Switch id="plan-gallery" checked={field.value} onCheckedChange={field.onChange} />}
                  />
                </Field>
                <Field orientation="horizontal">
                  <FieldLabel htmlFor="plan-menu">Carta digital + QR</FieldLabel>
                  <Controller
                    control={control}
                    name="digitalMenuEnabled"
                    render={({ field }) => <Switch id="plan-menu" checked={field.value} onCheckedChange={field.onChange} />}
                  />
                </Field>
              </div>
            </div>

            )}

            {clientError && <p className="text-sm text-destructive">{clientError}</p>}

            <Field orientation="horizontal">
              <FieldLabel htmlFor="plan-active">Activo (disponible para contratar)</FieldLabel>
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
