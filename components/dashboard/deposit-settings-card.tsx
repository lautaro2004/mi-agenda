"use client";

import * as React from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { requestJson } from "@/lib/api-client";
import { useBusinessSubscription } from "@/lib/subscription-client";
import { paymentSettingsSchema, type PaymentSettingsValues } from "@/lib/schemas";
import type { Business } from "@/lib/types";

interface DepositSettingsCardProps {
  business: Business;
  onSaved: (business: Business) => void;
}

// Sección aparte de "Identidad/Contacto/Redes" (ver app/dashboard/negocio/page.tsx):
// tiene su propio endpoint (PATCH /api/business/payment-settings) porque los
// campos son condicionales entre sí de una forma que no encaja en
// businessInfoSchema. Con depositRequired = false, ningún campo bancario se
// muestra — un negocio que no usa señas ni siquiera ve estos campos (ver
// sección 1/13 de la tarea).
export function DepositSettingsCard({ business, onSaved }: DepositSettingsCardProps) {
  const [justSaved, setJustSaved] = React.useState(false);
  const { data: subscriptionData } = useBusinessSubscription();
  const depositsEnabled = subscriptionData?.subscription?.plan.depositsEnabled ?? true;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<PaymentSettingsValues>({
    resolver: zodResolver(paymentSettingsSchema),
    values: {
      depositRequired: business.depositRequired,
      depositType: business.depositType,
      depositFixedAmount: business.depositFixedAmount,
      depositPercentage: business.depositPercentage,
      depositAlias: business.depositAlias,
      depositCbu: business.depositCbu,
      depositBankName: business.depositBankName,
      depositAccountHolder: business.depositAccountHolder,
      depositTaxId: business.depositTaxId,
      depositInstructions: business.depositInstructions,
    },
  });

  const depositRequired = useWatch({ control, name: "depositRequired" });
  const depositType = useWatch({ control, name: "depositType" });

  async function onSubmit(values: PaymentSettingsValues) {
    try {
      const { business: updated } = await requestJson<{ business: Business }>("/api/business/payment-settings", {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      onSaved(updated);
      toast.success("Cambios guardados");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos guardar los cambios.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">Pagos y señas</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Si activás esto, Nexo va a pedir una seña antes de confirmar cada turno y va a esperar el
            comprobante por WhatsApp.
          </p>
        </div>
        <Controller
          control={control}
          name="depositRequired"
          render={({ field }) => (
            <Switch
              checked={field.value}
              // Solo se bloquea intentar ACTIVARLA — si ya estaba activa (ej.
              // el negocio bajó de plan con señas ya configuradas), se puede
              // seguir apagando sin trabas.
              onCheckedChange={(checked) => {
                if (checked && !depositsEnabled) return;
                field.onChange(checked);
              }}
              aria-label="Pedir seña"
            />
          )}
        />
      </div>

      {!depositsEnabled && !depositRequired && (
        <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <p className="text-foreground">La gestión de señas y comprobantes está disponible desde el plan Esencial.</p>
          <Link href="/dashboard/suscripcion" className="mt-1 inline-block font-medium text-[var(--brand-primary,var(--primary))] hover:underline">
            Ver planes →
          </Link>
        </div>
      )}

      {depositRequired && (
        <FieldGroup className="mt-5">
          <Field data-invalid={!!errors.depositType}>
            <FieldLabel htmlFor="depositType">Tipo de seña</FieldLabel>
            <Controller
              control={control}
              name="depositType"
              render={({ field }) => (
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <SelectTrigger id="depositType" className="w-full" aria-invalid={!!errors.depositType}>
                    <SelectValue placeholder="Elegí monto fijo o porcentaje" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Monto fijo</SelectItem>
                    <SelectItem value="percentage">Porcentaje del total</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.depositType]} />
          </Field>

          {depositType === "fixed" && (
            <Field data-invalid={!!errors.depositFixedAmount}>
              <FieldLabel htmlFor="depositFixedAmount">Monto de la seña ($)</FieldLabel>
              <Controller
                control={control}
                name="depositFixedAmount"
                render={({ field }) => (
                  <Input
                    id="depositFixedAmount"
                    type="number"
                    min={0}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                  />
                )}
              />
              <FieldError errors={[errors.depositFixedAmount]} />
            </Field>
          )}

          {depositType === "percentage" && (
            <Field data-invalid={!!errors.depositPercentage}>
              <FieldLabel htmlFor="depositPercentage">Porcentaje de seña (%)</FieldLabel>
              <Controller
                control={control}
                name="depositPercentage"
                render={({ field }) => (
                  <Input
                    id="depositPercentage"
                    type="number"
                    min={0}
                    max={100}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value === "" ? null : Number(e.target.value))}
                  />
                )}
              />
              <FieldError errors={[errors.depositPercentage]} />
              <FieldDescription>Se calcula sobre el precio del servicio reservado.</FieldDescription>
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="depositAlias">Alias</FieldLabel>
              <Input id="depositAlias" placeholder="Ej: minegocio.mp" {...register("depositAlias")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="depositCbu">CBU / CVU</FieldLabel>
              <Input id="depositCbu" {...register("depositCbu")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="depositBankName">Banco o billetera</FieldLabel>
              <Input id="depositBankName" placeholder="Ej: Mercado Pago" {...register("depositBankName")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="depositAccountHolder">Titular de la cuenta</FieldLabel>
              <Input id="depositAccountHolder" {...register("depositAccountHolder")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="depositTaxId">CUIT / DNI (opcional)</FieldLabel>
              <Input id="depositTaxId" {...register("depositTaxId")} />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="depositInstructions">Mensaje adicional para el cliente</FieldLabel>
            <Textarea
              id="depositInstructions"
              rows={3}
              placeholder='Ej: "Una vez realizada la transferencia, enviá el comprobante por este mismo chat."'
              {...register("depositInstructions")}
            />
          </Field>
        </FieldGroup>
      )}

      <Field className="mt-5">
        <Button type="submit" disabled={isSubmitting} className="w-fit">
          {justSaved ? (
            <>
              <Check className="size-4" data-icon="inline-start" />
              Guardado
            </>
          ) : (
            "Guardar cambios"
          )}
        </Button>
      </Field>
    </form>
  );
}
