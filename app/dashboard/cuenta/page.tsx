"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, Building2, Calendar, Check, KeyRound, Loader2, MessageSquare, Store } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { AssetUploader } from "@/components/dashboard/asset-uploader";
import { Skeleton } from "@/components/ui/skeleton";
import { useOnboarding } from "@/lib/onboarding-store";
import { authClient } from "@/lib/auth/auth-client";
import { profileSchema, changePasswordSchema, type ProfileFormValues, type ChangePasswordFormValues } from "@/lib/schemas";

const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "long", year: "numeric" });

type SaveState = "idle" | "saving" | "saved" | "error";
const SAVED_LABEL_MS = 2500;

function SaveButton({ state, className }: { state: SaveState; className?: string }) {
  return (
    <Button type="submit" disabled={state === "saving"} variant={state === "error" ? "destructive" : "default"} className={className}>
      {state === "saving" ? (
        <>
          <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
          Guardando...
        </>
      ) : state === "saved" ? (
        <>
          <Check className="size-4" data-icon="inline-start" />
          Guardado
        </>
      ) : state === "error" ? (
        <>
          <AlertTriangle className="size-4" data-icon="inline-start" />
          No se pudo guardar
        </>
      ) : (
        "Guardar cambios"
      )}
    </Button>
  );
}

function ProfileCard() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [saveState, setSaveState] = React.useState<SaveState>("idle");

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: { name: session?.user?.name ?? "", image: session?.user?.image ?? null },
  });

  async function onSubmit(values: ProfileFormValues) {
    setSaveState("saving");
    try {
      await authClient.updateUser({ name: values.name, image: values.image ?? undefined });
      await refetch();
      toast.success("Perfil actualizado");
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), SAVED_LABEL_MS);
    } catch {
      toast.error("No pudimos guardar los cambios. Intentá de nuevo.");
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), SAVED_LABEL_MS);
    }
  }

  if (isPending) return <Skeleton className="h-64 rounded-2xl" />;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-border bg-card p-6">
      <h3 className="text-base font-semibold text-foreground">Perfil</h3>
      <p className="mt-1 text-sm text-muted-foreground">Tu nombre y foto, visibles solo para vos en el dashboard.</p>

      <FieldGroup className="mt-5">
        <Field>
          <FieldLabel>Foto</FieldLabel>
          <Controller
            control={control}
            name="image"
            render={({ field }) => (
              <AssetUploader kind="avatar" value={field.value} onChange={field.onChange} endpoint="/api/account/avatar" />
            )}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Nombre</FieldLabel>
            <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input id="email" value={session?.user?.email ?? ""} disabled readOnly />
          </Field>
        </div>
      </FieldGroup>

      <div className="mt-5">
        <SaveButton state={saveState} />
      </div>
    </form>
  );
}

function PasswordCard() {
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmNewPassword: "" },
  });

  async function onSubmit(values: ChangePasswordFormValues) {
    setSaveState("saving");
    try {
      const { error } = await authClient.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      if (error) throw new Error(error.message ?? "No pudimos cambiar la contraseña.");
      toast.success("Contraseña actualizada");
      reset();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), SAVED_LABEL_MS);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No pudimos cambiar la contraseña.");
      setSaveState("error");
      setTimeout(() => setSaveState("idle"), SAVED_LABEL_MS);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-muted-foreground" />
        <h3 className="text-base font-semibold text-foreground">Contraseña</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Necesitás tu contraseña actual para cambiarla.</p>

      <FieldGroup className="mt-5">
        <Field data-invalid={!!errors.currentPassword}>
          <FieldLabel htmlFor="currentPassword">Contraseña actual</FieldLabel>
          <Input id="currentPassword" type="password" autoComplete="current-password" aria-invalid={!!errors.currentPassword} {...register("currentPassword")} />
          <FieldError errors={[errors.currentPassword]} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field data-invalid={!!errors.newPassword}>
            <FieldLabel htmlFor="newPassword">Nueva contraseña</FieldLabel>
            <Input id="newPassword" type="password" autoComplete="new-password" aria-invalid={!!errors.newPassword} {...register("newPassword")} />
            <FieldError errors={[errors.newPassword]} />
          </Field>

          <Field data-invalid={!!errors.confirmNewPassword}>
            <FieldLabel htmlFor="confirmNewPassword">Confirmar nueva contraseña</FieldLabel>
            <Input id="confirmNewPassword" type="password" autoComplete="new-password" aria-invalid={!!errors.confirmNewPassword} {...register("confirmNewPassword")} />
            <FieldError errors={[errors.confirmNewPassword]} />
          </Field>
        </div>
      </FieldGroup>

      <div className="mt-5">
        <SaveButton state={saveState} />
      </div>
    </form>
  );
}

function Row({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-4 last:border-0 last:pb-0">
      <dt className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

export default function MyAccountPage() {
  const { state, hydrated } = useOnboarding();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { business } = state;

  const loading = !hydrated || sessionPending;

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Mi perfil" description="Tus datos de usuario y el negocio asociado." />

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      ) : (
        <>
          <ProfileCard />
          <PasswordCard />

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-base font-semibold text-foreground">Negocio asociado</h3>
            <dl className="mt-5 space-y-4 text-sm">
              <Row icon={Building2} label="Negocio" value={business.name || "Sin definir"} />
              <Row icon={Store} label="Rubro" value={business.category || "Sin definir"} />
              <Row icon={MessageSquare} label="WhatsApp configurado" value={business.whatsappNumber || "No configurado"} />
              <Row
                icon={Calendar}
                label="Fecha de alta"
                value={session?.user?.createdAt ? dateFormatter.format(new Date(session.user.createdAt)) : "—"}
              />
            </dl>

            <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
              <Button size="sm" variant="outline" render={<Link href="/dashboard/negocio" />} nativeButton={false}>
                Editar datos del negocio
              </Button>
              <Button size="sm" variant="outline" render={<Link href="/dashboard/suscripcion" />} nativeButton={false}>
                Ver suscripción
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
