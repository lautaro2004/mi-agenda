"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, CalendarClock, Loader2, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NewAppointmentDialog } from "@/components/dashboard/new-appointment-dialog";
import { RescheduleAppointmentDialog } from "@/components/dashboard/reschedule-appointment-dialog";
import { PaymentReviewDialog } from "@/components/dashboard/payment-review-dialog";
import { useOnboarding } from "@/lib/onboarding-store";
import type { Appointment, AppointmentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

// pending_payment/payment_submitted/payment_rejected solo aparecen en
// negocios con la seña activada (ver sección 7 de la tarea, tabla con
// 🟡/🟢/🔴). Un negocio sin seña nunca produce estos tres, así que el resto
// de esta pantalla queda exactamente igual para ese caso.
const STATUS_META: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  confirmed: { label: "Confirmado", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  cancelled: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
  completed: { label: "Completado", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  no_show: { label: "No asistió", className: "bg-destructive/10 text-destructive" },
  pending_payment: { label: "🟡 Seña pendiente", className: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400" },
  payment_submitted: { label: "🟡 Comprobante recibido", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  payment_rejected: { label: "🔴 Comprobante rechazado", className: "bg-destructive/10 text-destructive" },
};

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(y, m - 1, d),
  );
}

export default function TurnosPage() {
  const { state: onboardingState } = useOnboarding();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [error, setError] = useState<string | null>(null);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter && statusFilter !== "active") params.set("status", statusFilter);
      const res = await fetch(`/api/appointments?${params}`);
      if (!res.ok) throw new Error("Error al cargar turnos");
      const data = (await res.json()) as { appointments: Appointment[] };
      let list = data.appointments;
      if (statusFilter === "active") {
        list = list.filter((a) =>
          ["confirmed", "pending", "pending_payment", "payment_submitted", "payment_rejected"].includes(a.status),
        );
      }
      setAppointments(list);
    } catch {
      setError("No se pudieron cargar los turnos. Verificá la conexión a la base de datos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAppointments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const handleCancel = async (id: string) => {
    if (!confirm("¿Cancelar este turno?")) return;
    setCancellingIds((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      await fetchAppointments();
    } finally {
      setCancellingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Turnos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Turnos reservados por WhatsApp, o agendados manualmente acá.
          </p>
        </div>
        <NewAppointmentDialog
          services={onboardingState.services}
          onCreated={() => void fetchAppointments()}
          trigger={
            <Button>
              <Plus className="size-4" data-icon="inline-start" />
              Agendar turno
            </Button>
          }
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nombre, teléfono o servicio…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="active">Activos</option>
          <option value="confirmed">Confirmados</option>
          <option value="pending">Pendientes</option>
          <option value="pending_payment">Pago pendiente</option>
          <option value="payment_submitted">Comprobante recibido</option>
          <option value="payment_rejected">Rechazados</option>
          <option value="cancelled">Cancelados</option>
          <option value="completed">Completados</option>
          <option value="">Todos</option>
        </select>
      </div>

      {/* Content */}
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-muted/20 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <CalendarCheck2 className="size-6" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">No hay turnos para mostrar</p>
          <p className="text-xs text-muted-foreground">
            Los turnos reservados por WhatsApp o agendados manualmente aparecerán aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const cancelling = cancellingIds.has(appt.id);
            return (
              <div
                key={appt.id}
                className={cn(
                  "flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-opacity",
                  cancelling && "pointer-events-none opacity-50"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{appt.customerName}</p>
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11px] font-medium",
                        STATUS_META[appt.status as AppointmentStatus]?.className,
                      )}
                    >
                      {STATUS_META[appt.status as AppointmentStatus]?.label ?? appt.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {appt.serviceName} · {formatDate(appt.date)} a las {appt.startTime}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{appt.customerPhone}</p>
                </div>
                {appt.depositAmount != null && (
                  <PaymentReviewDialog
                    appointmentId={appt.id}
                    onUpdated={(updated) =>
                      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
                    }
                    trigger={
                      <button className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                        Ver pago
                      </button>
                    }
                  />
                )}
                {["confirmed", "pending", "pending_payment", "payment_submitted", "payment_rejected"].includes(
                  appt.status,
                ) && (
                  <div className="flex shrink-0 items-center gap-2">
                    <RescheduleAppointmentDialog
                      appointment={appt}
                      onRescheduled={(updated) =>
                        setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
                      }
                      trigger={
                        <button
                          disabled={cancelling}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <CalendarClock className="size-3.5" />
                          Reprogramar
                        </button>
                      }
                    />
                    <button
                      onClick={() => void handleCancel(appt.id)}
                      disabled={cancelling}
                      className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {cancelling && <Loader2 className="size-3 animate-spin" />}
                      {cancelling ? "Cancelando…" : "Cancelar"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
