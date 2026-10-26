"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { ConsentNotice } from "@/components/legal/consent-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { buildLeadSubmissionSchema, type LeadFormConfig, type LeadSubmission } from "@/lib/lead-form";

interface LeadFormProps {
  slug: string;
  config: LeadFormConfig;
  submitLabel: string;
  // Contraste sobre el color de marca (botón y chips elegidos).
  tone: "light" | "dark";
}

// Hasta acá las opciones van como chips (un toque, sin abrir un menú);
// con más, un select nativo para no ocupar media pantalla en mobile.
const MAX_CHIP_OPTIONS = 5;

function optionalHint(required: boolean) {
  return required ? null : <span className="font-normal text-muted-foreground"> (opcional)</span>;
}

// Formulario de la plantilla de captación, armado según la configuración del
// negocio (lib/lead-form.ts). Valida con el mismo schema que la ruta pública.
// Mismo honeypot y aviso de consentimiento que InquiryForm.
export function LeadForm({ slug, config, submitLabel, tone }: LeadFormProps) {
  const onBrand = tone === "light" ? "text-white" : "text-neutral-950";
  const schema = React.useMemo(() => buildLeadSubmissionSchema(config), [config]);
  const defaultValues = React.useMemo(
    () => ({
      customerName: "",
      customerWhatsapp: "",
      customerEmail: "",
      companyName: "",
      location: "",
      message: "",
      answers: Object.fromEntries(config.custom.map((q) => [q.id, ""])),
      website: "",
    }),
    [config]
  );

  const [sent, setSent] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadSubmission>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- schema dinámico (depende de la config)
    resolver: zodResolver(schema as any),
    defaultValues: defaultValues as LeadSubmission,
  });

  async function submit(values: LeadSubmission) {
    setFormError(null);
    try {
      const res = await fetch(`/api/public/${slug}/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, form: "leads" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(body?.error ?? "No pudimos enviar tus datos. Probá de nuevo.");
        return;
      }
      setSent(true);
      reset(defaultValues as LeadSubmission);
    } catch {
      setFormError("No pudimos enviar tus datos. Probá de nuevo.");
    }
  }

  if (sent) {
    return (
      <div className="px-5 py-10 text-center sm:px-6">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="size-8 text-emerald-600 dark:text-emerald-400" />
        </span>
        <p className="mt-4 text-xl font-semibold text-foreground">¡Listo! Recibimos tus datos.</p>
        <p className="mt-1.5 text-sm text-muted-foreground">Te contactamos a la brevedad.</p>
        <Button type="button" variant="ghost" className="mt-5" onClick={() => setSent(false)}>
          Enviar otra solicitud
        </Button>
      </div>
    );
  }

  const { fields } = config;
  const answerErrors = (errors.answers ?? {}) as Record<string, { message?: string } | undefined>;

  return (
    <form onSubmit={handleSubmit(submit)} className="p-5 sm:p-6" noValidate>
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="lead-website">No completar</label>
        <input id="lead-website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field data-invalid={!!errors.customerName}>
          <FieldLabel htmlFor="lead-name">Nombre</FieldLabel>
          <Input id="lead-name" autoComplete="name" placeholder="Nombre y apellido" {...register("customerName")} />
          <FieldError errors={[errors.customerName]} />
        </Field>

        <Field data-invalid={!!errors.customerWhatsapp}>
          <FieldLabel htmlFor="lead-whatsapp">WhatsApp</FieldLabel>
          <Input
            id="lead-whatsapp"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="Ej: 11 5555-5555"
            {...register("customerWhatsapp")}
          />
          <FieldError errors={[errors.customerWhatsapp]} />
        </Field>

        {fields.customerEmail.mode !== "hidden" && (
          <Field data-invalid={!!errors.customerEmail}>
            <FieldLabel htmlFor="lead-email">
              {fields.customerEmail.label}
              {optionalHint(fields.customerEmail.mode === "required")}
            </FieldLabel>
            <Input id="lead-email" type="email" autoComplete="email" placeholder="tu@email.com" {...register("customerEmail")} />
            <FieldError errors={[errors.customerEmail]} />
          </Field>
        )}

        {fields.companyName.mode !== "hidden" && (
          <Field data-invalid={!!errors.companyName}>
            <FieldLabel htmlFor="lead-company">
              {fields.companyName.label}
              {optionalHint(fields.companyName.mode === "required")}
            </FieldLabel>
            <Input id="lead-company" autoComplete="organization" {...register("companyName")} />
            <FieldError errors={[errors.companyName]} />
          </Field>
        )}

        {fields.location.mode !== "hidden" && (
          <Field data-invalid={!!errors.location}>
            <FieldLabel htmlFor="lead-location">
              {fields.location.label}
              {optionalHint(fields.location.mode === "required")}
            </FieldLabel>
            <Input id="lead-location" autoComplete="address-level2" {...register("location")} />
            <FieldError errors={[errors.location]} />
          </Field>
        )}

        {config.custom.map((q) => {
          const error = answerErrors[q.id];
          const name = `answers.${q.id}` as const;

          if (q.type === "select" && q.options.length <= MAX_CHIP_OPTIONS) {
            return (
              <fieldset key={q.id} className="sm:col-span-2" aria-invalid={!!error}>
                <legend className="text-sm font-medium text-foreground">
                  {q.label}
                  {optionalHint(q.required)}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {q.options.map((option) => (
                    <label key={option} className="cursor-pointer">
                      <input type="radio" value={option} className="peer sr-only" {...register(name as never)} />
                      <span
                        className={cn(
                          "inline-flex h-9 items-center rounded-full border border-border bg-background px-4 text-sm transition-colors",
                          "peer-checked:border-[var(--brand-primary,var(--primary))] peer-checked:bg-[var(--brand-primary,var(--primary))]",
                          tone === "light" ? "peer-checked:text-white" : "peer-checked:text-neutral-950",
                          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 hover:border-foreground/30"
                        )}
                      >
                        {option}
                      </span>
                    </label>
                  ))}
                </div>
                {error?.message && <p className="mt-1.5 text-sm text-destructive">{error.message}</p>}
              </fieldset>
            );
          }

          if (q.type === "select") {
            return (
              <Field key={q.id} data-invalid={!!error} className="sm:col-span-2">
                <FieldLabel htmlFor={`lead-${q.id}`}>
                  {q.label}
                  {optionalHint(q.required)}
                </FieldLabel>
                <select
                  id={`lead-${q.id}`}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  {...register(name as never)}
                >
                  <option value="">Elegí una opción</option>
                  {q.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                {error?.message && <p className="text-sm text-destructive">{error.message}</p>}
              </Field>
            );
          }

          return (
            <Field key={q.id} data-invalid={!!error} className="sm:col-span-2">
              <FieldLabel htmlFor={`lead-${q.id}`}>
                {q.label}
                {optionalHint(q.required)}
              </FieldLabel>
              <Input id={`lead-${q.id}`} {...register(name as never)} />
              {error?.message && <p className="text-sm text-destructive">{error.message}</p>}
            </Field>
          );
        })}

        {fields.message.mode !== "hidden" && (
          <Field data-invalid={!!errors.message} className="sm:col-span-2">
            <FieldLabel htmlFor="lead-message">
              {fields.message.label}
              {optionalHint(fields.message.mode === "required")}
            </FieldLabel>
            <Textarea id="lead-message" rows={3} {...register("message")} />
            <FieldError errors={[errors.message]} />
          </Field>
        )}
      </div>

      {formError && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {formError}
        </p>
      )}

      <ConsentNotice variant="customer" className="mt-5" />

      <Button
        type="submit"
        size="lg"
        className={cn(
          "mt-3 h-12 w-full bg-[var(--brand-primary,var(--primary))] text-base font-semibold hover:bg-[var(--brand-primary,var(--primary))]/90",
          onBrand
        )}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Enviando…
          </>
        ) : (
          <>
            {submitLabel}
            <ArrowRight className="size-4" data-icon="inline-end" />
          </>
        )}
      </Button>
    </form>
  );
}
