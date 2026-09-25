"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MailCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/schemas";
import { authClient } from "@/lib/auth/auth-client";

// La confirmación es SIEMPRE la misma exista o no la cuenta: la pantalla nunca
// revela si un email está registrado.
export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordValues) {
    setFormError(null);
    setSubmitting(true);

    const { error } = await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: "/restablecer-contrasena",
    });
    setSubmitting(false);

    // Un error real (red, límite de intentos) sí se informa; "el usuario no
    // existe" no es un error para el cliente: el servidor responde igual.
    if (error) {
      setFormError(
        error.status === 429
          ? "Hiciste muchos intentos. Esperá un momento y probá de nuevo."
          : "No pudimos procesar tu pedido. Intentá de nuevo en un rato."
      );
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div>
        <MailCheck className="mb-4 size-8 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Revisá tu email</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Si existe una cuenta con ese email, te enviamos un enlace para elegir una contraseña nueva. Vence en 1 hora y
          se puede usar una sola vez.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Recuperá tu contraseña</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ingresá tu email y te enviamos un enlace para elegir una contraseña nueva.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          {formError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>
          )}

          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              autoComplete="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            <FieldError errors={[errors.email]} />
          </Field>

          <Field>
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Enviar enlace
            </Button>
          </Field>
        </FieldGroup>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
