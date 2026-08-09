"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { ScheduleEditor } from "@/components/onboarding/schedule-editor";
import { StepActions } from "@/components/onboarding/step-actions";
import { scheduleSchema } from "@/lib/schemas";
import { type BusinessSchedule } from "@/lib/types";
import { useOnboarding } from "@/lib/onboarding-store";
import { z } from "zod";

type ScheduleFormValues = { schedule: z.infer<typeof scheduleSchema> };

export default function ScheduleStepPage() {
  const router = useRouter();
  const { state, setSchedule, setStep } = useOnboarding();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(z.object({ schedule: scheduleSchema })),
    defaultValues: { schedule: state.schedule },
  });

  async function onSubmit(values: ScheduleFormValues) {
    try {
      await setSchedule(values.schedule as BusinessSchedule);
      setStep(3);
      router.push("/onboarding/servicios");
    } catch {
      toast.error("No pudimos guardar los horarios. Intentá de nuevo.");
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Definí tus horarios de atención
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Elegí un esquema rápido y ajustá los detalles. Podés agregar un descanso para el almuerzo.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Controller
          control={control}
          name="schedule"
          render={({ field }) => (
            <ScheduleEditor
              value={field.value as BusinessSchedule}
              onChange={field.onChange}
              errors={errors.schedule}
            />
          )}
        />

        <StepActions submit backHref="/onboarding/negocio" nextLabel="Continuar" />
      </form>
    </div>
  );
}
