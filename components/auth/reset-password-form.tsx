"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/schemas";
import { authClient } from "@/lib/auth/auth-client";

function InvalidLink() {
  return (
    <div>
      <TriangleAlert className="mb-4 size-8 text-destructive" />
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Enlace inválido o vencido</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Este enlace ya se usó o venció. Pedí uno nuevo para elegir tu contraseña.
      </p>
      <Link href="/recuperar-contrasena" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
        Pedir un enlace nuevo
      </Link>
    </div>
  );
}

// `token` llega por query (Better Auth redirige a /restablecer-contrasena?token=…
// o ?error=INVALID_TOKEN). Sin token válido no se muestra el formulario.
export function ResetPasswordForm({ token, hasError }: { token: string | null; hasError: boolean }) {
  const [submitting, setSubmitting] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [invalid, setInvalid] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  if (!token || hasError || invalid) return <InvalidLink />;

  if (done) {
    return (
      <div>
        <CheckCircle2 className="mb-4 size-8 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Contraseña actualizada</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ya podés iniciar sesión con tu contraseña nueva. Cerramos las demás sesiones abiertas por seguridad.
        </p>
        <Link href="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  async function onSubmit(values: ResetPasswordValues) {
    setFormError(null);
    setSubmitting(true);

    const { error } = await authClient.resetPassword({ newPassword: values.newPassword, token: token! });
    setSubmitting(false);

    if (error) {
      // Token vencido, ya usado o inexistente: pantalla de enlace inválido.
      if (error.code === "INVALID_TOKEN" || error.status === 400) {
        setInvalid(true);
        return;
      }
      setFormError(error.message ?? "No pudimos actualizar tu contraseña. Intentá de nuevo.");
      return;
    }
    setDone(true);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Elegí una contraseña nueva</h1>
        <p className="mt-2 text-sm text-muted-foreground">Mínimo 8 caracteres.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          {formError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</p>
          )}

          <Field data-invalid={!!errors.newPassword}>
            <FieldLabel htmlFor="newPassword">Contraseña nueva</FieldLabel>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.newPassword}
              {...register("newPassword")}
            />
            <FieldError errors={[errors.newPassword]} />
          </Field>

          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">Repetí la contraseña</FieldLabel>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            <FieldError errors={[errors.confirmPassword]} />
          </Field>

          <Field>
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Guardar contraseña
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
