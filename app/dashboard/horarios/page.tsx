"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScheduleEditor } from "@/components/onboarding/schedule-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { scheduleSchema } from "@/lib/schemas";
import { type BusinessSchedule } from "@/lib/types";
import { useOnboarding } from "@/lib/onboarding-store";

type ScheduleFormValues = { schedule: z.infer<typeof scheduleSchema> };

export default function ScheduleSettingsPage() {
  const { state, hydrated, refresh, setSchedule } = useOnboarding();

  React.useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ScheduleFormValues>({
    resolver: zodResolver(z.object({ schedule: scheduleSchema })),
    values: { schedule: state.schedule },
  });

  async function onSubmit(values: ScheduleFormValues) {
    try {
      await setSchedule(values.schedule as BusinessSchedule);
      toast.success("Horarios actualizados");
    } catch {
      toast.error("No pudimos guardar los horarios. Intentá de nuevo.");
    }
  }

  if (!hydrated) {
    return (
      <div>
        <PageHeader
          title="Horarios"
          description="Definí los días y horarios en los que tu negocio atiende."
        />
        <div className="max-w-2xl space-y-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Horarios"
        description="Definí los días y horarios en los que tu negocio atiende."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
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

        <Field>
          <Button type="submit" disabled={isSubmitting} className="w-fit">
            Guardar cambios
          </Button>
        </Field>
      </form>
    </div>
  );
}
