"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { requestJson } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { leadFormSchema, type LeadFormValues } from "@/lib/schemas";
import { BUSINESS_CATEGORIES, LEAD_GOALS, LEAD_GOAL_LABEL, LEAD_MONTHLY_VOLUMES, LEAD_MONTHLY_VOLUME_LABEL } from "@/lib/types";

const DEFAULTS: LeadFormValues = {
  name: "",
  businessName: "",
  whatsapp: "",
  email: "",
  industry: "",
  goals: [],
  monthlyVolume: undefined,
  message: "",
  wantsMeeting: false,
  website: "",
};

// Formulario público (sección 2 del pedido) — un solo paso, agrupado
// visualmente en vez de un wizard multi-paso: 9 campos es manejable en un
// modal con scroll interno, y evita el estado extra de un stepper para un
// MVP que no lo necesita.
export function LeadForm({ onSuccess }: { onSuccess: (wantsMeeting: boolean) => void }) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: DEFAULTS,
  });

  const [submitError, setSubmitError] = React.useState<string | null>(null);

  async function onSubmit(values: LeadFormValues) {
    setSubmitError(null);
    try {
      await requestJson("/api/leads", { method: "POST", body: JSON.stringify(values) });
      onSuccess(values.wantsMeeting);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "No pudimos enviar tu consulta. Probá de nuevo.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Honeypot anti-spam: oculto por CSS, un bot que autocompleta todos
          los inputs sí lo llena — un visitante real nunca lo ve ni lo toca. */}
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="lead-website">No completar</label>
        <input id="lead-website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <FieldGroup>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="lead-name">Nombre</FieldLabel>
            <Input id="lead-name" aria-invalid={!!errors.name} {...register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>

          <Field data-invalid={!!errors.businessName}>
            <FieldLabel htmlFor="lead-business">Nombre del negocio</FieldLabel>
            <Input id="lead-business" aria-invalid={!!errors.businessName} {...register("businessName")} />
            <FieldError errors={[errors.businessName]} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.whatsapp}>
            <FieldLabel htmlFor="lead-whatsapp">WhatsApp</FieldLabel>
            <Input id="lead-whatsapp" placeholder="Ej: +54 9 11 5555-5555" aria-invalid={!!errors.whatsapp} {...register("whatsapp")} />
            <FieldError errors={[errors.whatsapp]} />
          </Field>

          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="lead-email">Email</FieldLabel>
            <Input id="lead-email" type="email" aria-invalid={!!errors.email} {...register("email")} />
            <FieldError errors={[errors.email]} />
          </Field>
        </div>

        <Field data-invalid={!!errors.industry}>
          <FieldLabel htmlFor="lead-industry">Rubro</FieldLabel>
          <Controller
            control={control}
            name="industry"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                <SelectTrigger id="lead-industry" className="w-full" aria-invalid={!!errors.industry}>
                  <SelectValue placeholder="Elegí un rubro" />
                </SelectTrigger>
                <SelectContent>
                  {BUSINESS_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.industry]} />
        </Field>

        <Field data-invalid={!!errors.goals}>
          <FieldLabel>¿Qué querés mejorar?</FieldLabel>
          <Controller
            control={control}
            name="goals"
            render={({ field }) => (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {LEAD_GOALS.map((goal) => {
                  const checked = field.value.includes(goal);
                  return (
                    <label
                      key={goal}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                        checked ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(next) => {
                          field.onChange(next ? [...field.value, goal] : field.value.filter((g) => g !== goal));
                        }}
                      />
                      {LEAD_GOAL_LABEL[goal]}
                    </label>
                  );
                })}
              </div>
            )}
          />
          <FieldError errors={[errors.goals]} />
        </Field>

        <Field data-invalid={!!errors.monthlyVolume}>
          <FieldLabel htmlFor="lead-volume">¿Cuántas consultas o reservas reciben aproximadamente?</FieldLabel>
          <Controller
            control={control}
            name="monthlyVolume"
            render={({ field }) => (
              <Select value={field.value} onValueChange={(v) => field.onChange(v || undefined)}>
                <SelectTrigger id="lead-volume" className="w-full">
                  <SelectValue placeholder="Elegí una opción (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_MONTHLY_VOLUMES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {LEAD_MONTHLY_VOLUME_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.monthlyVolume]} />
        </Field>

        <Field data-invalid={!!errors.message}>
          <FieldLabel htmlFor="lead-message">Contanos un poco más sobre lo que necesitás</FieldLabel>
          <Textarea id="lead-message" rows={3} placeholder="Opcional" aria-invalid={!!errors.message} {...register("message")} />
          <FieldError errors={[errors.message]} />
        </Field>

        <Field>
          <FieldLabel>¿Querés que coordinemos una reunión?</FieldLabel>
          <Controller
            control={control}
            name="wantsMeeting"
            render={({ field }) => (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  aria-pressed={field.value === true}
                  onClick={() => field.onChange(true)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    field.value === true ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  Sí, quiero hablar con alguien
                </button>
                <button
                  type="button"
                  aria-pressed={field.value === false}
                  onClick={() => field.onChange(false)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                    field.value === false ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:border-primary/40"
                  )}
                >
                  Primero quiero recibir información
                </button>
              </div>
            )}
          />
        </Field>
      </FieldGroup>

      <p className="text-xs text-muted-foreground">
        Al enviar este formulario aceptás que podamos contactarte para responder tu consulta.
      </p>

      {submitError && <p className="text-sm text-destructive">{submitError}</p>}

      <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Enviando...
          </>
        ) : (
          <>
            <CheckCircle2 className="size-4" data-icon="inline-start" />
            Quiero una evaluación
          </>
        )}
      </Button>
    </form>
  );
}
