"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { registerSchema, type RegisterFormValues } from "@/lib/schemas";
import { useOnboarding } from "@/lib/onboarding-store";
import { authClient } from "@/lib/auth/auth-client";

export function RegisterForm() {
  const router = useRouter();
  const { updateBusiness } = useOnboarding();
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      businessName: "",
      ownerName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(values: RegisterFormValues) {
    setFormError(null);
    setSubmitting(true);

    const { error } = await authClient.signUp.email({
      name: values.ownerName,
      email: values.email,
      password: values.password,
    });

    if (error) {
      setFormError(error.message ?? "No pudimos crear tu cuenta. Intentá de nuevo.");
      setSubmitting(false);
      return;
    }

    const setupResponse = await fetch("/api/business/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessName: values.businessName }),
    });

    if (!setupResponse.ok) {
      setFormError(
        "Tu cuenta se creó, pero no pudimos terminar de configurar tu negocio. Iniciá sesión y, si el problema persiste, contactanos."
      );
      setSubmitting(false);
      return;
    }

    try {
      await updateBusiness({ name: values.businessName });
    } catch {
      // El negocio ya quedó creado por /api/business/setup; esto solo sincroniza el estado local.
    }

    router.push("/onboarding");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Creá tu cuenta
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Empezá a configurar tu negocio en minutos.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
          {formError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </p>
          )}

          <Field data-invalid={!!errors.businessName}>
            <FieldLabel htmlFor="businessName">Nombre del negocio</FieldLabel>
            <Input
              id="businessName"
              placeholder="Ej: Barbería El Buen Corte"
              autoComplete="organization"
              aria-invalid={!!errors.businessName}
              {...register("businessName")}
            />
            <FieldError errors={[errors.businessName]} />
          </Field>

          <Field data-invalid={!!errors.ownerName}>
            <FieldLabel htmlFor="ownerName">Tu nombre</FieldLabel>
            <Input
              id="ownerName"
              placeholder="Ej: Juan Pérez"
              autoComplete="name"
              aria-invalid={!!errors.ownerName}
              {...register("ownerName")}
            />
            <FieldError errors={[errors.ownerName]} />
          </Field>

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

          <Field data-invalid={!!errors.password}>
            <FieldLabel htmlFor="password">Contraseña</FieldLabel>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register("password")}
            />
            <FieldDescription>Mínimo 8 caracteres.</FieldDescription>
            <FieldError errors={[errors.password]} />
          </Field>

          <Field data-invalid={!!errors.confirmPassword}>
            <FieldLabel htmlFor="confirmPassword">Confirmar contraseña</FieldLabel>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register("confirmPassword")}
            />
            <FieldError errors={[errors.confirmPassword]} />
          </Field>

          <Field>
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Crear cuenta
            </Button>
          </Field>
        </FieldGroup>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Iniciá sesión
        </Link>
      </p>
    </motion.div>
  );
}
