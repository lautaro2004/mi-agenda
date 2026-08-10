"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

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
import { isBookableService, type Appointment, type Service } from "@/lib/types";
import { manualAppointmentSchema, type ManualAppointmentValues } from "@/lib/schemas";

interface NewAppointmentDialogProps {
  trigger: React.ReactElement;
  services: Service[];
  onCreated: (appointment: Appointment) => void;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

export function NewAppointmentDialog({ trigger, services, onCreated }: NewAppointmentDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [slots, setSlots] = React.useState<string[] | null>(null);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [resourceOptions, setResourceOptions] = React.useState<ResourceOption[] | null>(null);
  const [loadingResources, setLoadingResources] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const bookableServices = React.useMemo(() => services.filter(isBookableService), [services]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ManualAppointmentValues>({
    resolver: zodResolver(manualAppointmentSchema),
    defaultValues: {
      serviceId: "",
      customerName: "",
      customerPhone: "",
      date: todayIso(),
      startTime: "",
      notes: "",
      resourceId: undefined,
    },
  });

  const date = watch("date");
  const serviceId = watch("serviceId");
  const startTime = watch("startTime");
  const resourceId = watch("resourceId");

  // La disponibilidad se recalcula acá con el mismo motor que usa WhatsApp
  // (getAvailableSlots vía GET /api/appointments/availability, ahora
  // resource-aware) — nunca se inventa localmente qué horarios mostrar.
  const fetchSlots = React.useCallback(async (forDate: string, forService: string) => {
    if (!forDate) return;
    setLoadingSlots(true);
    setSlots(null);
    try {
      const params = new URLSearchParams({ date: forDate });
      if (forService) params.set("serviceId", forService);
      const { slots: available } = await requestJson<{ slots: string[] }>(
        `/api/appointments/availability?${params}`
      );
      setSlots(available);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) void fetchSlots(date, serviceId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date, serviceId]);

  // Desglose por recurso: solo aplica si el servicio elegido usa recursos
  // (si no, esto devuelve [] y el picker de recursos ni se muestra).
  const fetchResourceOptions = React.useCallback(
    async (forService: string, forDate: string, forStartTime: string) => {
      if (!forService || !forDate || !forStartTime) {
        setResourceOptions(null);
        return;
      }
      setLoadingResources(true);
      try {
        const params = new URLSearchParams({ serviceId: forService, date: forDate, startTime: forStartTime });
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
    []
  );

  React.useEffect(() => {
    if (open) void fetchResourceOptions(serviceId, date, startTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, serviceId, date, startTime]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setFormError(null);
    if (next) {
      reset({
        serviceId: "",
        customerName: "",
        customerPhone: "",
        date: todayIso(),
        startTime: "",
        notes: "",
        resourceId: undefined,
      });
      setResourceOptions(null);
    }
  }

  async function submit(values: ManualAppointmentValues) {
    setFormError(null);
    try {
      const { appointment } = await requestJson<{ appointment: Appointment }>("/api/appointments", {
        method: "POST",
        body: JSON.stringify(values),
      });
      onCreated(appointment);
      setOpen(false);
    } catch (error) {
      // Si el horario (o el recurso puntual elegido) se ocupó justo antes de
      // confirmar, revalidado recién en el servidor: refrescamos todo para
      // que el dueño vea el estado real en vez de reintentar contra algo que
      // ya no está disponible.
      void fetchSlots(date, serviceId);
      void fetchResourceOptions(serviceId, date, startTime);
      setValue("startTime", "");
      setValue("resourceId", undefined);
      setFormError(error instanceof Error ? error.message : "No pudimos agendar el turno.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar turno</DialogTitle>
          <DialogDescription>
            Se crea igual que una reserva por WhatsApp: queda sujeto a la misma disponibilidad.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(submit)} id="new-appointment-form">
          <FieldGroup>
            <Field data-invalid={!!errors.serviceId}>
              <FieldLabel htmlFor="appointment-service">Servicio</FieldLabel>
              <Controller
                control={control}
                name="serviceId"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      setValue("startTime", "");
                      setValue("resourceId", undefined);
                    }}
                  >
                    <SelectTrigger id="appointment-service" className="w-full" aria-invalid={!!errors.serviceId}>
                      <SelectValue placeholder="Seleccioná un servicio" />
                    </SelectTrigger>
                    <SelectContent>
                      {bookableServices.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No hay servicios reservables por turno.
                        </div>
                      ) : (
                        bookableServices.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} · {service.durationMinutes} min
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError errors={[errors.serviceId]} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.date}>
                <FieldLabel htmlFor="appointment-date">Fecha</FieldLabel>
                <Input
                  id="appointment-date"
                  type="date"
                  min={todayIso()}
                  aria-invalid={!!errors.date}
                  {...register("date")}
                />
                <FieldError errors={[errors.date]} />
              </Field>

              <Field data-invalid={!!errors.startTime}>
                <FieldLabel htmlFor="appointment-time">Horario</FieldLabel>
                <Controller
                  control={control}
                  name="startTime"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        setValue("resourceId", undefined);
                      }}
                    >
                      <SelectTrigger id="appointment-time" className="w-full" aria-invalid={!!errors.startTime}>
                        <SelectValue
                          placeholder={loadingSlots ? "Buscando horarios…" : "Elegí un horario"}
                        />
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
              onChange={(value) => setValue("resourceId", value ?? undefined)}
            />

            <Field data-invalid={!!errors.customerName}>
              <FieldLabel htmlFor="appointment-customer-name">Cliente</FieldLabel>
              <Input
                id="appointment-customer-name"
                placeholder="Nombre y apellido"
                aria-invalid={!!errors.customerName}
                {...register("customerName")}
              />
              <FieldError errors={[errors.customerName]} />
            </Field>

            <Field data-invalid={!!errors.customerPhone}>
              <FieldLabel htmlFor="appointment-customer-phone">Teléfono</FieldLabel>
              <Input
                id="appointment-customer-phone"
                placeholder="Ej: +54 9 11 5555-5555"
                aria-invalid={!!errors.customerPhone}
                {...register("customerPhone")}
              />
              <FieldError errors={[errors.customerPhone]} />
            </Field>

            <Field data-invalid={!!errors.notes}>
              <FieldLabel htmlFor="appointment-notes">Observaciones</FieldLabel>
              <Textarea
                id="appointment-notes"
                placeholder="Opcional"
                rows={2}
                aria-invalid={!!errors.notes}
                {...register("notes")}
              />
              <FieldError errors={[errors.notes]} />
            </Field>
          </FieldGroup>

          {formError && <p className="mt-3 text-sm text-destructive">{formError}</p>}
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="new-appointment-form" disabled={isSubmitting || bookableServices.length === 0}>
            {isSubmitting ? <Loader2 className="size-4 animate-spin" data-icon="inline-start" /> : null}
            Agendar turno
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
