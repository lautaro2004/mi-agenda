"use client";

import * as React from "react";
import Link from "next/link";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { ResourcePicker, type ResourceOption } from "@/components/dashboard/resource-picker";
import { manualAppointmentSchema, type ManualAppointmentValues } from "@/lib/schemas";
import { isBookableService, type Service } from "@/lib/types";

interface BookingWidgetProps {
  slug: string;
  services: Service[];
  // Preselección opcional (ej. venís de "Reservar" en una card de servicio
  // puntual en la página principal) — ver /s/[slug]/reservar?servicio=...
  initialServiceId?: string;
}

interface ConfirmedBooking {
  service: string;
  date: string;
  time: string;
  resource: string | null;
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(
    new Date(y, m - 1, d)
  );
}

// Reserva pública — reutiliza exactamente el mismo motor que el turno
// manual del dashboard y el Booking Flow de WhatsApp: mismo schema
// (manualAppointmentSchema), mismo ResourcePicker, y del otro lado la misma
// createAppointment()/getAvailableSlots() (vía /api/public/[slug]/*, que
// solo cambia CÓMO se resuelve el negocio — por slug, no por sesión). Se usa
// tal cual tanto en la sección de reserva de /s/[slug] como en la página
// dedicada /s/[slug]/reservar — nunca un segundo componente.
export function BookingWidget({ slug, services, initialServiceId }: BookingWidgetProps) {
  // Solo servicios reservables de verdad — defensivo: aunque hoy siempre
  // llega ya filtrado desde el caller, nunca hay que asumirlo silenciosamente
  // (ver isBookableService, durationMinutes = 0 = no es un turno).
  const bookableServices = React.useMemo(() => services.filter(isBookableService), [services]);

  const [slots, setSlots] = React.useState<string[] | null>(null);
  const [loadingSlots, setLoadingSlots] = React.useState(false);
  const [slotsError, setSlotsError] = React.useState(false);
  const [resourceOptions, setResourceOptions] = React.useState<ResourceOption[] | null>(null);
  const [loadingResources, setLoadingResources] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [confirmed, setConfirmed] = React.useState<ConfirmedBooking | null>(null);

  const defaultServiceId =
    (initialServiceId && bookableServices.some((s) => s.id === initialServiceId) ? initialServiceId : undefined) ??
    bookableServices[0]?.id ??
    "";

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ManualAppointmentValues>({
    resolver: zodResolver(manualAppointmentSchema),
    defaultValues: {
      serviceId: defaultServiceId,
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

  const fetchSlots = React.useCallback(
    async (forDate: string, forService: string) => {
      if (!forDate || !forService) return;
      setLoadingSlots(true);
      setSlotsError(false);
      setSlots(null);
      try {
        const params = new URLSearchParams({ date: forDate, serviceId: forService });
        const res = await fetch(`/api/public/${slug}/availability?${params}`);
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { slots?: string[] };
        setSlots(data.slots ?? []);
      } catch {
        setSlots(null);
        setSlotsError(true);
      } finally {
        setLoadingSlots(false);
      }
    },
    [slug]
  );

  const fetchResourceOptions = React.useCallback(
    async (forService: string, forDate: string, forStartTime: string) => {
      if (!forService || !forDate || !forStartTime) {
        setResourceOptions(null);
        return;
      }
      setLoadingResources(true);
      try {
        const params = new URLSearchParams({ serviceId: forService, date: forDate, startTime: forStartTime });
        const res = await fetch(`/api/public/${slug}/resources?${params}`);
        const data = (await res.json()) as { resources?: ResourceOption[] };
        setResourceOptions(data.resources ?? null);
      } catch {
        setResourceOptions(null);
      } finally {
        setLoadingResources(false);
      }
    },
    [slug]
  );

  React.useEffect(() => {
    void fetchSlots(date, serviceId);
  }, [date, serviceId, fetchSlots]);

  React.useEffect(() => {
    void fetchResourceOptions(serviceId, date, startTime);
  }, [serviceId, date, startTime, fetchResourceOptions]);

  function resetForm() {
    reset({
      serviceId: defaultServiceId,
      customerName: "",
      customerPhone: "",
      date: todayIso(),
      startTime: "",
      notes: "",
      resourceId: undefined,
    });
  }

  async function submit(values: ManualAppointmentValues) {
    setFormError(null);
    try {
      const res = await fetch(`/api/public/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "No pudimos confirmar la reserva.");

      const service = services.find((s) => s.id === values.serviceId);
      const resource = values.resourceId
        ? (resourceOptions?.find((r) => r.id === values.resourceId)?.name ?? null)
        : null;
      setConfirmed({ service: service?.name ?? "Turno", date: values.date, time: values.startTime, resource });
    } catch (error) {
      // Revalidado en el servidor: si el horario/recurso se ocupó mientras
      // completaba el formulario, refrescamos para mostrar el estado real
      // en vez de dejar que reintente contra algo que ya no está.
      void fetchSlots(date, serviceId);
      void fetchResourceOptions(serviceId, date, startTime);
      setValue("startTime", "");
      setValue("resourceId", undefined);
      setFormError(error instanceof Error ? error.message : "No pudimos confirmar la reserva.");
    }
  }

  if (bookableServices.length === 0) return null;

  if (confirmed) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 text-center sm:p-8">
        <CheckCircle2 className="mx-auto size-10 text-emerald-600 dark:text-emerald-400" />
        <p className="mt-4 text-lg font-semibold text-foreground">¡Reserva confirmada!</p>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          <p>{confirmed.service}</p>
          <p className="capitalize">
            {formatDate(confirmed.date)} a las {confirmed.time}
          </p>
          {confirmed.resource && <p>{confirmed.resource}</p>}
        </div>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setConfirmed(null);
              resetForm();
            }}
          >
            Agregar otra reserva
          </Button>
          <Button type="button" render={<Link href={`/s/${slug}`} />} nativeButton={false}>
            Volver al inicio
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <FieldGroup>
        <Field data-invalid={!!errors.serviceId}>
          <FieldLabel htmlFor="booking-service">Servicio</FieldLabel>
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
                <SelectTrigger id="booking-service" className="w-full">
                  {/* Base UI Select.Value NO resuelve la etiqueta legible del
                      item seleccionado por su cuenta cuando el popup está
                      cerrado (no mantiene los SelectItem montados) — sin esta
                      función children, muestra el value crudo (el id). */}
                  <SelectValue placeholder="Elegí un servicio">
                    {(value: string) => {
                      const service = bookableServices.find((s) => s.id === value);
                      return service ? `${service.name} · ${service.durationMinutes} min` : null;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {bookableServices.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      {service.name} · {service.durationMinutes} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.serviceId]} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!errors.date}>
            <FieldLabel htmlFor="booking-date">Fecha</FieldLabel>
            <Input id="booking-date" type="date" min={todayIso()} {...register("date")} />
            <FieldError errors={[errors.date]} />
          </Field>

          <Field data-invalid={!!errors.startTime}>
            <FieldLabel htmlFor="booking-time">Horario</FieldLabel>
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
                  <SelectTrigger id="booking-time" className="w-full">
                    <SelectValue placeholder={loadingSlots ? "Buscando…" : "Elegí un horario"} />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingSlots ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        Buscando horarios disponibles…
                      </div>
                    ) : slots && slots.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No hay horarios disponibles para esta fecha.
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
            {slotsError && (
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="size-3.5 shrink-0" />
                No pudimos consultar la disponibilidad. Intentá nuevamente.
              </p>
            )}
          </Field>
        </div>

        <ResourcePicker
          loading={loadingResources}
          options={resourceOptions}
          value={resourceId}
          onChange={(value) => setValue("resourceId", value ?? undefined)}
        />

        <Field data-invalid={!!errors.customerName}>
          <FieldLabel htmlFor="booking-name">Tu nombre</FieldLabel>
          <Input id="booking-name" placeholder="Nombre y apellido" {...register("customerName")} />
          <FieldError errors={[errors.customerName]} />
        </Field>

        <Field data-invalid={!!errors.customerPhone}>
          <FieldLabel htmlFor="booking-phone">Tu WhatsApp</FieldLabel>
          <Input id="booking-phone" placeholder="Ej: +54 9 11 5555-5555" {...register("customerPhone")} />
          <FieldError errors={[errors.customerPhone]} />
        </Field>
      </FieldGroup>

      {formError && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {formError}
        </p>
      )}

      <Button type="submit" className="mt-5 w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
            Confirmando reserva…
          </>
        ) : (
          "Confirmar reserva"
        )}
      </Button>
    </form>
  );
}
