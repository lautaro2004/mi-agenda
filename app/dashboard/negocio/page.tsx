"use client";

import * as React from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { PageHeader } from "@/components/dashboard/page-header";
import { BusinessPreviewCard } from "@/components/dashboard/business-preview-card";
import { LogoUploader } from "@/components/onboarding/logo-uploader";
import { Skeleton } from "@/components/ui/skeleton";
import { businessInfoSchema, type BusinessInfoValues } from "@/lib/schemas";
import { BUSINESS_CATEGORIES } from "@/lib/types";
import { useOnboarding } from "@/lib/onboarding-store";

export default function BusinessSettingsPage() {
  const { state, hydrated, refresh, updateBusiness } = useOnboarding();
  const [justSaved, setJustSaved] = React.useState(false);

  // Ver comentario en OnboardingContextValue.refresh: el negocio pudo
  // haberse entrenado por chat después de la foto inicial de este Provider.
  React.useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BusinessInfoValues>({
    resolver: zodResolver(businessInfoSchema),
    values: {
      name: state.business.name,
      logoUrl: state.business.logoUrl,
      category: (state.business.category || undefined) as BusinessInfoValues["category"],
      description: state.business.description,
      phone: state.business.phone,
      whatsappNumber: state.business.whatsappNumber,
      address: state.business.address,
      instagramUrl: state.business.instagramUrl,
      facebookUrl: state.business.facebookUrl,
    },
  });

  const preview = useWatch({ control });

  async function onSubmit(values: BusinessInfoValues) {
    try {
      await updateBusiness(values);
      toast.success("Cambios guardados");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch {
      toast.error("No pudimos guardar los cambios. Intentá de nuevo.");
    }
  }

  if (!hydrated) {
    return (
      <div>
        <PageHeader
          title="Negocio"
          description="Esta información se utiliza para presentar tu negocio a tus clientes."
        />
        <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="space-y-6">
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </div>
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Negocio"
        description="Esta información se utiliza para presentar tu negocio a tus clientes."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-base font-semibold text-foreground">Identidad</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Cómo te van a ver tus clientes.
            </p>

            <FieldGroup className="mt-5">
              <Field>
                <FieldLabel>Logo</FieldLabel>
                <Controller
                  control={control}
                  name="logoUrl"
                  render={({ field }) => (
                    <LogoUploader value={field.value} onChange={field.onChange} />
                  )}
                />
                <FieldDescription>Opcional. PNG o JPG, idealmente cuadrado.</FieldDescription>
              </Field>

              <Field data-invalid={!!errors.name}>
                <FieldLabel htmlFor="name">Nombre del negocio</FieldLabel>
                <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
                <FieldError errors={[errors.name]} />
              </Field>

              <Field data-invalid={!!errors.category}>
                <FieldLabel htmlFor="category">Rubro</FieldLabel>
                <Controller
                  control={control}
                  name="category"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="category" className="w-full" aria-invalid={!!errors.category}>
                        <SelectValue placeholder="Seleccioná un rubro" />
                      </SelectTrigger>
                      <SelectContent>
                        {BUSINESS_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.category]} />
              </Field>

              <Field data-invalid={!!errors.description}>
                <FieldLabel htmlFor="description">Descripción corta</FieldLabel>
                <Textarea id="description" rows={4} aria-invalid={!!errors.description} {...register("description")} />
                <FieldDescription>Máximo 280 caracteres.</FieldDescription>
                <FieldError errors={[errors.description]} />
              </Field>
            </FieldGroup>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-base font-semibold text-foreground">Contacto</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Estos datos se usan para que tus clientes te encuentren y te escriban.
            </p>

            <FieldGroup className="mt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.phone}>
                  <FieldLabel htmlFor="phone">Teléfono</FieldLabel>
                  <Input
                    id="phone"
                    placeholder="Ej: +54 11 5555-5555"
                    aria-invalid={!!errors.phone}
                    {...register("phone")}
                  />
                  <FieldError errors={[errors.phone]} />
                </Field>

                <Field data-invalid={!!errors.whatsappNumber}>
                  <FieldLabel htmlFor="whatsappNumber">Número de WhatsApp</FieldLabel>
                  <Input
                    id="whatsappNumber"
                    placeholder="Ej: +54 9 11 5555-5555"
                    aria-invalid={!!errors.whatsappNumber}
                    {...register("whatsappNumber")}
                  />
                  <FieldError errors={[errors.whatsappNumber]} />
                </Field>
              </div>

              <Field data-invalid={!!errors.address}>
                <FieldLabel htmlFor="address">Dirección</FieldLabel>
                <Input
                  id="address"
                  placeholder="Ej: Av. Siempre Viva 742, Springfield"
                  aria-invalid={!!errors.address}
                  {...register("address")}
                />
                <FieldError errors={[errors.address]} />
              </Field>
            </FieldGroup>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-base font-semibold text-foreground">Redes sociales</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Opcional. Compartí tus perfiles para que tus clientes te sigan.
            </p>

            <FieldGroup className="mt-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={!!errors.instagramUrl}>
                  <FieldLabel htmlFor="instagramUrl">Instagram</FieldLabel>
                  <Input
                    id="instagramUrl"
                    placeholder="https://instagram.com/tu-negocio"
                    aria-invalid={!!errors.instagramUrl}
                    {...register("instagramUrl")}
                  />
                  <FieldError errors={[errors.instagramUrl]} />
                </Field>

                <Field data-invalid={!!errors.facebookUrl}>
                  <FieldLabel htmlFor="facebookUrl">Facebook</FieldLabel>
                  <Input
                    id="facebookUrl"
                    placeholder="https://facebook.com/tu-negocio"
                    aria-invalid={!!errors.facebookUrl}
                    {...register("facebookUrl")}
                  />
                  <FieldError errors={[errors.facebookUrl]} />
                </Field>
              </div>
            </FieldGroup>
          </div>

          <Field>
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

        <div className="lg:sticky lg:top-8">
          <BusinessPreviewCard
            name={preview.name ?? ""}
            logoUrl={preview.logoUrl ?? null}
            category={preview.category ?? ""}
            address={preview.address ?? ""}
            whatsappNumber={preview.whatsappNumber ?? ""}
          />
        </div>
      </div>
    </div>
  );
}
