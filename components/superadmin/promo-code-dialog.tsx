"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wand2 } from "lucide-react";

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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { requestJson } from "@/lib/api-client";
import { promoCodeSchema, type PromoCodeFormInput, type PromoCodeFormValues } from "@/lib/schemas";
import { generatePromoCode } from "@/modules/promo-codes/validate";

interface PlanOption {
  id: string;
  slug: string;
  name: string;
  active: boolean;
}

const DURATION_PRESETS = [
  { days: 30, label: "1 mes" },
  { days: 60, label: "2 meses" },
  { days: 90, label: "3 meses" },
  { days: 180, label: "6 meses" },
  { days: 365, label: "12 meses" },
];
const CUSTOM_DURATION = "custom";

interface PromoCodeLike {
  id: string;
  code: string;
  planId: string;
  durationDays: number;
  maxUses: number | null;
  expiresAt: string; // ISO
  active: boolean;
  description: string | null;
}

interface PromoCodeDialogProps {
  trigger: React.ReactElement;
  promoCode?: PromoCodeLike;
  onSubmit: (values: PromoCodeFormValues) => void;
}

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

// Mismo patrón que components/superadmin/plan-dialog.tsx: un único diálogo
// sirve para crear y editar (promoCode presente = editar).
export function PromoCodeDialog({ trigger, promoCode, onSubmit }: PromoCodeDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [plans, setPlans] = React.useState<PlanOption[] | null>(null);
  const isPreset = DURATION_PRESETS.some((p) => p.days === promoCode?.durationDays);
  const [durationMode, setDurationMode] = React.useState<string>(
    promoCode && !isPreset ? CUSTOM_DURATION : String(promoCode?.durationDays ?? 90)
  );
  const [unlimitedUses, setUnlimitedUses] = React.useState(promoCode ? promoCode.maxUses === null : false);

  const defaultExpiresAt = React.useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const defaults: PromoCodeFormInput = {
    code: promoCode?.code ?? "",
    planId: promoCode?.planId ?? "",
    durationDays: promoCode?.durationDays ?? 90,
    maxUses: promoCode?.maxUses ?? 1,
    expiresAt: promoCode ? toDateInputValue(promoCode.expiresAt) : defaultExpiresAt,
    active: promoCode?.active ?? true,
    description: promoCode?.description ?? "",
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PromoCodeFormInput, unknown, PromoCodeFormValues>({
    resolver: zodResolver(promoCodeSchema),
    defaultValues: defaults,
  });

  const planId = watch("planId");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      reset(defaults);
      setDurationMode(promoCode && !isPreset ? CUSTOM_DURATION : String(promoCode?.durationDays ?? 90));
      setUnlimitedUses(promoCode ? promoCode.maxUses === null : false);
      requestJson<{ plans: PlanOption[] }>("/api/superadmin/planes")
        .then(({ plans }) => setPlans(plans))
        .catch(() => setPlans([]));
    }
  }

  function handleGenerate() {
    const plan = plans?.find((p) => p.id === planId);
    const days = Number(watch("durationDays")) || 90;
    setValue("code", generatePromoCode(plan?.slug ?? "nexo", days), { shouldValidate: true });
  }

  function submit(values: PromoCodeFormValues) {
    onSubmit({ ...values, maxUses: unlimitedUses ? null : values.maxUses });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{promoCode ? "Editar código" : "Nuevo código promocional"}</DialogTitle>
          <DialogDescription>
            El código bonifica el plan elegido por la duración indicada al aplicarse — nunca se borra, solo se agota
            o se desactiva.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} id="promo-code-form">
          <FieldGroup>
            <Field data-invalid={!!errors.code}>
              <FieldLabel htmlFor="promo-code">Código</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="promo-code"
                  placeholder="NEXO-PRO-3M-8K4F"
                  className="font-mono uppercase"
                  aria-invalid={!!errors.code}
                  {...register("code")}
                />
                <Button type="button" variant="outline" size="icon" onClick={handleGenerate} aria-label="Generar código">
                  <Wand2 className="size-4" />
                </Button>
              </div>
              <FieldError errors={[errors.code]} />
            </Field>

            <Field data-invalid={!!errors.planId}>
              <FieldLabel htmlFor="promo-plan">Plan que otorga</FieldLabel>
              <Controller
                control={control}
                name="planId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                    <SelectTrigger id="promo-plan" className="w-full" aria-invalid={!!errors.planId}>
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

            <Field data-invalid={!!errors.durationDays}>
              <FieldLabel htmlFor="promo-duration">Duración de la bonificación</FieldLabel>
              <Select
                value={durationMode}
                onValueChange={(v) => {
                  if (!v) return;
                  setDurationMode(v);
                  if (v !== CUSTOM_DURATION) setValue("durationDays", Number(v), { shouldValidate: true });
                }}
              >
                <SelectTrigger id="promo-duration" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_PRESETS.map((p) => (
                    <SelectItem key={p.days} value={String(p.days)}>
                      {p.label}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_DURATION}>Cantidad de días personalizada</SelectItem>
                </SelectContent>
              </Select>
              {durationMode === CUSTOM_DURATION && (
                <Input
                  type="number"
                  min="1"
                  className="mt-2"
                  placeholder="Cantidad de días"
                  aria-invalid={!!errors.durationDays}
                  {...register("durationDays")}
                />
              )}
              <FieldError errors={[errors.durationDays]} />
            </Field>

            <Field data-invalid={!!errors.maxUses}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="promo-uses">Cantidad máxima de usos</FieldLabel>
                <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Switch checked={unlimitedUses} onCheckedChange={setUnlimitedUses} />
                  Sin límite
                </label>
              </div>
              {!unlimitedUses && (
                <Controller
                  control={control}
                  name="maxUses"
                  render={({ field }) => (
                    <Input
                      id="promo-uses"
                      type="number"
                      min="1"
                      value={typeof field.value === "number" ? field.value : ""}
                      onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                    />
                  )}
                />
              )}
              <FieldError errors={[errors.maxUses]} />
            </Field>

            <Field data-invalid={!!errors.expiresAt}>
              <FieldLabel htmlFor="promo-expires">Fecha de vencimiento del código</FieldLabel>
              <Input id="promo-expires" type="date" aria-invalid={!!errors.expiresAt} {...register("expiresAt")} />
              <FieldError errors={[errors.expiresAt]} />
            </Field>

            <Field data-invalid={!!errors.description}>
              <FieldLabel htmlFor="promo-description">Descripción interna (opcional)</FieldLabel>
              <Textarea id="promo-description" rows={2} placeholder="Para qué cliente/campaña es este código" {...register("description")} />
              <FieldDescription>Solo la ve Superadmin, nunca el negocio que lo aplica.</FieldDescription>
              <FieldError errors={[errors.description]} />
            </Field>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="promo-active">Activo</FieldLabel>
              <Controller
                control={control}
                name="active"
                render={({ field }) => <Switch id="promo-active" checked={field.value} onCheckedChange={field.onChange} />}
              />
            </Field>
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="promo-code-form">
            {promoCode ? "Guardar cambios" : "Crear código"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
