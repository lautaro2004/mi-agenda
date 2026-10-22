"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";

import { ConsentNotice } from "@/components/legal/consent-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { inquirySchema, type InquiryFormValues } from "@/lib/schemas";

const DEFAULT_VALUES: InquiryFormValues = {
  customerName: "",
  customerWhatsapp: "",
  customerEmail: "",
  message: "",
  companyName: "",
  location: "",
  website: "",
};

interface InquiryFormProps {
  slug: string;
  // "leads" = plantilla de captación: suma negocio + zona y cambia los
  // textos a "solicitud" en vez de "consulta". Default: el de siempre.
  variant?: "default" | "leads";
}

// Formulario de consultas del sitio público. Mismo patrón que
// booking-widget.tsx (react-hook-form + zodResolver + primitivos de
// components/ui) y mismo honeypot que components/landing/lead-form.tsx.
export function InquiryForm({ slug, variant = "default" }: InquiryFormProps) {
  const isLeads = variant === "leads";
  const [sent, setSent] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InquiryFormValues>({
    resolver: zodResolver(inquirySchema),
    defaultValues: DEFAULT_VALUES,
  });

  async function submit(values: InquiryFormValues) {
    setFormError(null);
    try {
      const res = await fetch(`/api/public/${slug}/inquiry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setFormError(body?.error ?? "No pudimos enviar tu consulta. Probá de nuevo.");
        return;
      }
      setSent(true);
      reset(DEFAULT_VALUES);
    } catch {
      setFormError("No pudimos enviar tu consulta. Probá de nuevo.");
    }
  }

  if (sent) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600 dark:text-emerald-400" />
        <p className="mt-4 text-lg font-semibold text-foreground">
          {isLeads ? "¡Listo! Recibimos tus datos." : "Consulta enviada correctamente."}
        </p>
        {isLeads && (
          <p className="mt-1.5 text-sm text-muted-foreground">Te contactamos a la brevedad por WhatsApp o email.</p>
        )}
        <Button type="button" variant="outline" className="mt-6" onClick={() => setSent(false)}>
          {isLeads ? "Enviar otra solicitud" : "Enviar otra consulta"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="sr-only" aria-hidden="true">
        <label htmlFor="inquiry-website">No completar</label>
        <input id="inquiry-website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
      </div>

      <FieldGroup>
        <Field data-invalid={!!errors.customerName}>
          <FieldLabel htmlFor="inquiry-name">Nombre</FieldLabel>
          <Input id="inquiry-name" placeholder="Nombre y apellido" {...register("customerName")} />
          <FieldError errors={[errors.customerName]} />
        </Field>

        {isLeads && (
          <Field data-invalid={!!errors.companyName}>
            <FieldLabel htmlFor="inquiry-company">Nombre de tu negocio</FieldLabel>
            <Input id="inquiry-company" placeholder="Ej: Pizzería Don Juan" {...register("companyName")} />
            <FieldError errors={[errors.companyName]} />
          </Field>
        )}

        <Field data-invalid={!!errors.customerWhatsapp}>
          <FieldLabel htmlFor="inquiry-whatsapp">WhatsApp</FieldLabel>
          <Input id="inquiry-whatsapp" placeholder="Ej: +54 9 11 5555-5555" {...register("customerWhatsapp")} />
          <FieldError errors={[errors.customerWhatsapp]} />
        </Field>

        <Field data-invalid={!!errors.customerEmail}>
          <FieldLabel htmlFor="inquiry-email">Email</FieldLabel>
          <Input id="inquiry-email" type="email" placeholder="tu@email.com" {...register("customerEmail")} />
          <FieldError errors={[errors.customerEmail]} />
        </Field>

        {isLeads && (
          <Field data-invalid={!!errors.location}>
            <FieldLabel htmlFor="inquiry-location">Zona o localidad</FieldLabel>
            <Input id="inquiry-location" placeholder="Ej: Palermo, CABA" {...register("location")} />
            <FieldError errors={[errors.location]} />
          </Field>
        )}

        <Field data-invalid={!!errors.message}>
          <FieldLabel htmlFor="inquiry-message">{isLeads ? "¿Qué necesitás?" : "Consulta"}</FieldLabel>
          <Textarea
            id="inquiry-message"
            rows={isLeads ? 3 : 4}
            placeholder={isLeads ? "Contanos brevemente sobre tu negocio" : "Contanos en qué te podemos ayudar"}
            {...register("message")}
          />
          <FieldError errors={[errors.message]} />
        </Field>
      </FieldGroup>

      {formError && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {formError}
        </p>
      )}

      <ConsentNotice variant="customer" className="mt-5" />

      <Button type="submit" className="mt-3 w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="size-4" data-icon="inline-start" />
            {isLeads ? "Quiero que me contacten" : "Enviar consulta"}
          </>
        )}
      </Button>
    </form>
  );
}
