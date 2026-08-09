"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

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
import { StepActions } from "@/components/onboarding/step-actions";
import { LogoUploader } from "@/components/onboarding/logo-uploader";
import { businessInfoSchema, type BusinessInfoValues } from "@/lib/schemas";
import { BUSINESS_CATEGORIES } from "@/lib/types";
import { useOnboarding } from "@/lib/onboarding-store";

export default function BusinessInfoStepPage() {
  const router = useRouter();
  const { state, updateBusiness, setStep } = useOnboarding();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<BusinessInfoValues>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: {
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

  async function onSubmit(values: BusinessInfoValues) {
    try {
      await updateBusiness(values);
      setStep(2);
      router.push("/onboarding/horarios");
    } catch {
      toast.error("No pudimos guardar los datos del negocio. Intentá de nuevo.");
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Contanos sobre tu negocio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta información ayudará a tus clientes a conocer tu negocio.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <FieldGroup>
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
            <Input
              id="name"
              placeholder="Ej: Barbería El Buen Corte"
              aria-invalid={!!errors.name}
              {...register("name")}
            />
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
            <Textarea
              id="description"
              placeholder="Contanos brevemente qué hace tu negocio y qué lo hace especial."
              rows={4}
              aria-invalid={!!errors.description}
              {...register("description")}
            />
            <FieldDescription>Máximo 280 caracteres.</FieldDescription>
            <FieldError errors={[errors.description]} />
          </Field>

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

        <StepActions submit nextLabel="Continuar" />
      </form>
    </div>
  );
}
