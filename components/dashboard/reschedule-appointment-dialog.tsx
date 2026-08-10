"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ResourcePicker, type ResourceOption } from "@/components/dashboard/resource-picker";
import { requestJson } from "@/lib/api-client";
import type { Appointment } from "@/lib/types";
import { rescheduleAppointmentSchema, type RescheduleAppointmentValues } from "@/lib/schemas";

interface RescheduleAppointmentDialogProps {
  trigger: React.ReactElement;
  appointment: Appointment;
  onRescheduled: (appointment: Appointment) => void;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

// Mismo motor y el mismo selector de recursos (ResourcePicker) que "Agendar
// turno" — esto no es una segunda lógica de reservas, es PATCH sobre el
// mismo rescheduleAppointment() que ya revalida disponibilidad/recurso en
// una transacción, excluyendo al propio turno como conflicto de sí mismo.
export function RescheduleAppointmentDialog({
  trigger,
  appointment,
  onRescheduled,
}: RescheduleAppointmentDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [slots, setSlots] = React.useState<string[] | null>(null);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [resourceOptions, setResourceOptions] = React.useState<ResourceOption[] | null>(null);
  const [loadingResources, setLoadingResources] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RescheduleAppointmentValues>({
    resolver: zodResolver(rescheduleAppointmentSchema),
    defaultValues: {
      date: appointment.date,
      startTime: appointment.startTime,
      durationMinutes: appointment.durationMinutes,
      // Precargado con el recurso que ya tenía — visualmente refleja que la
      // reprogramación intenta mantenerlo, no reasignar desde cero.
      resourceId: appointment.resourceId ?? undefined,
    },
  });

  const date = watch("date");
  const startTime = watch("startTime");
  const resourceId = watch("resourceId");

  const fetchSlots = React.useCallback(
    async (forDate: string) => {
      if (!forDate) return;
      setLoadingSlots(true);
      setSlots(null);
      try {
        const params = new URLSearchParams({ date: forDate, excludeAppointmentId: appointment.id });
        if (appointment.serviceId) params.set("serviceId", appointment.serviceId);
        const { slots: available } = await requestJson<{ slots: string[] }>(
          `/api/appointments/availability?${params}`
        );
        setSlots(available);
      } catch {
        setSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    },
    [appointment.id, appointment.serviceId]
  );

  const fetchResourceOptions = React.useCallback(
    async (forDate: string, forStartTime: string) => {
      if (!appointment.serviceId || !forDate || !forStartTime) {
        setResourceOptions(null);
        return;
      }
      setLoadingResources(true);
      try {
        const params = new URLSearchParams({
          serviceId: appointment.serviceId,
          date: forDate,
          startTime: forStartTime,
          excludeAppointmentId: appointment.id,
        });
        const { resources } = await requestJson<{ resources: ResourceOption[] }>(
          `/api/appointments/resources?${params}`
        );
        setResourceOptions(resources);
      } catch {
        setResourceOptions(null);
      } finally {
        setLoadingResources(false);
      }
    },
    [appointment.id, appointment.serviceId]
  );

  React.useEffect(() => {
    if (open) void fetchSlots(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  React.useEffect(() => {
    if (open) void fetchResourceOptions(date, startTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, startTime]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setFormError(null);
    if (next) {
      reset({
        date: appointment.date,
        startTime: appointment.startTime,
        durationMinutes: appointment.durationMinutes,
        resourceId: appointment.resourceId ?? undefined,
      });
    }
  }

  async function submit(values: RescheduleAppointmentValues) {
    setFormError(null);
    try {
      const { appointment: updated } = await requestJson<{ appointment: Appointment }>(
        `/api/appointments/${appointment.id}`,
        { method: "PATCH", body: JSON.stringify({ action: "reschedule", ...values }) }
      );
      onRescheduled(updated);
      setOpen(false);
    } catch (error) {
      // Revalidado en el servidor: si el horario/recurso se ocupó mientras
      // el dueño decidía, refrescamos todo para mostrar el estado real.
      void fetchSlots(date);
      void fetchResourceOptions(date, startTime);
      setFormError(error instanceof Error ? error.message : "No pudimos reprogramar el turno.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reprogramar turno</DialogTitle>
          <DialogDescription>
            {appointment.serviceName} · {appointment.customerName}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} id="reschedule-appointment-form">
          <FieldGroup>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.date}>
                <FieldLabel htmlFor="reschedule-date">Fecha</FieldLabel>
                <Input
                  id="reschedule-date"
                  type="date"
                  min={todayIso()}
                  aria-invalid={!!errors.date}
                  {...register("date")}
                />
                <FieldError errors={[errors.date]} />
              </Field>

              <Field data-invalid={!!errors.startTime}>
                <FieldLabel htmlFor="reschedule-time">Horario</FieldLabel>
                <Controller
                  control={control}
                  name="startTime"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setValue("resourceId", appointment.resourceId ?? undefined);
                      }}
                    >
                      <SelectTrigger id="reschedule-time" className="w-full" aria-invalid={!!errors.startTime}>
                        <SelectValue placeholder={loadingSlots ? "Buscando horarios…" : "Elegí un horario"} />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingSlots ? (
                          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                            <Loader2 className="size-3.5 animate-spin" />
                            Buscando horarios…
                          </div>
                        ) : slots && slots.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-muted-foreground">
                            No hay horarios disponibles ese día.
                          </div>
                        ) : (
                          (slots ?? []).map((slot) => (
                            <SelectItem key={slot} value={slot}>
                              {slot}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
                <FieldError errors={[errors.startTime]} />
              </Field>
            </div>

            <ResourcePicker
              loading={loadingResources}
              options={resourceOptions}
              value={resourceId}
              onChange={(value) => setValue("resourceId", value ?? null)}
            />
          </FieldGroup>

          {formError && <p className="mt-3 text-sm text-destructive">{formError}</p>}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="reschedule-appointment-form" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" data-icon="inline-start" /> : null}
            Reprogramar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
