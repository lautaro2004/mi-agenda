import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { BusinessSchedule } from "@/lib/types";
import { getSlotsForDate } from "@/modules/ai/booking/flow";
import { getActiveServiceResources } from "@/modules/business/resource";

// Único punto de entrada de disponibilidad/reserva del sistema — lo usan
// tanto el Booking Flow de WhatsApp (modules/ai/booking/flow.ts) como los
// diálogos de "Agendar turno" y "Reprogramar" del dashboard. Nunca duplicar
// esta lógica en otro lado: si hace falta un caso nuevo, se agrega acá.

const ACTIVE_STATUSES = ["pending", "confirmed"] as const;

function computeEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const end = h * 60 + m + durationMinutes;
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// Señales internas para abortar la transacción — se traducen a un
// { error: ... } afuera, nunca se escapan como excepciones reales hacia el
// caller.
class SlotTakenError extends Error {}
class InvalidResourceError extends Error {}
class AppointmentNotFoundError extends Error {}

interface ResolveAssignmentParams {
  businessId: string;
  serviceId: string | null;
  date: string;
  startTime: string;
  // Recurso preferido: si el servicio usa recursos, se intenta ESE primero
  // (nunca se reparte "al azar" entre otros si el preferido está libre).
  // undefined/null = sin preferencia → auto-asignar el primero libre entre
  // todos los recursos activos del servicio.
  preferredResourceId?: string | null;
  // El propio turno que se está reprogramando: nunca debe contar como
  // conflicto de sí mismo, ni en el chequeo de agenda general ni en el de
  // recursos.
  excludeAppointmentId?: string;
}

// Resuelve, dentro de una transacción, si el slot pedido está disponible y
// (si corresponde) qué recurso concreto queda asignado. Es el corazón
// compartido de createAppointment() y rescheduleAppointment() — ninguna de
// las dos vuelve a escribir su propio chequeo de conflicto.
async function resolveAssignment(
  tx: Prisma.TransactionClient,
  params: ResolveAssignmentParams,
): Promise<{ resourceId: string | null }> {
  const resources = params.serviceId
    ? await getActiveServiceResources(params.businessId, params.serviceId)
    : [];

  const excludeClause = params.excludeAppointmentId ? { id: { not: params.excludeAppointmentId } } : {};

  // El servicio no usa recursos: agenda general del negocio, sin cambios de
  // conducta respecto de como funcionaba antes de que existieran los
  // recursos.
  if (resources.length === 0) {
    const conflict = await tx.appointment.findFirst({
      where: {
        businessId: params.businessId,
        date: params.date,
        startTime: params.startTime,
        status: { in: [...ACTIVE_STATUSES] },
        ...excludeClause,
      },
    });
    if (conflict) throw new SlotTakenError();
    return { resourceId: null };
  }

  if (params.preferredResourceId && !resources.some((r) => r.id === params.preferredResourceId)) {
    throw new InvalidResourceError();
  }

  // Con preferencia (explícita, o la que ya tenía el turno): SOLO ese
  // candidato — si está ocupado, se rechaza, nunca se reasigna solo a otro
  // recurso en silencio. Sin preferencia: cualquiera de los activos sirve,
  // determinístico por orden de creación (ver getActiveServiceResources).
  const candidateIds = params.preferredResourceId ? [params.preferredResourceId] : resources.map((r) => r.id);

  const taken = await tx.appointment.findMany({
    where: {
      resourceId: { in: candidateIds },
      date: params.date,
      startTime: params.startTime,
      status: { in: [...ACTIVE_STATUSES] },
      ...excludeClause,
    },
    select: { resourceId: true },
  });
  const takenSet = new Set(taken.map((t) => t.resourceId));
  const freeId = candidateIds.find((id) => !takenSet.has(id));
  if (!freeId) throw new SlotTakenError();

  return { resourceId: freeId };
}

type BookingError = { error: "slot_taken" | "invalid_resource" };

function toBookingError(error: unknown): BookingError | null {
  if (error instanceof SlotTakenError || isUniqueConstraintError(error)) return { error: "slot_taken" };
  if (error instanceof InvalidResourceError) return { error: "invalid_resource" };
  return null;
}

export interface CreateAppointmentParams {
  businessId: string;
  businessName: string;
  serviceId: string | null;
  serviceName: string;
  customerName: string;
  customerPhone: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  notes?: string;
  // Selección manual explícita del recurso (solo tiene sentido si el
  // servicio usa recursos). Ausente/null = asignar automáticamente el
  // primer recurso activo que esté libre.
  resourceId?: string | null;
}

export async function createAppointment(params: CreateAppointmentParams) {
  await prisma.business.upsert({
    where: { id: params.businessId },
    update: { name: params.businessName },
    create: { id: params.businessId, name: params.businessName },
  });

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const { resourceId } = await resolveAssignment(tx, {
        businessId: params.businessId,
        serviceId: params.serviceId,
        date: params.date,
        startTime: params.startTime,
        preferredResourceId: params.resourceId,
      });

      return tx.appointment.create({
        data: {
          businessId: params.businessId,
          serviceId: params.serviceId,
          serviceName: params.serviceName,
          resourceId,
          customerName: params.customerName,
          customerPhone: params.customerPhone,
          date: params.date,
          startTime: params.startTime,
          endTime: computeEndTime(params.startTime, params.durationMinutes),
          durationMinutes: params.durationMinutes,
          status: "confirmed",
          notes: params.notes,
        },
      });
    });

    return { appointment };
  } catch (error) {
    const bookingError = toBookingError(error);
    if (bookingError) return bookingError;
    throw error;
  }
}

export async function getAppointments(
  businessId: string,
  filters?: { date?: string; status?: string; search?: string },
) {
  return prisma.appointment.findMany({
    where: {
      businessId,
      ...(filters?.date ? { date: filters.date } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.search
        ? {
            OR: [
              { customerName: { contains: filters.search, mode: "insensitive" } },
              { customerPhone: { contains: filters.search } },
              { serviceName: { contains: filters.search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

export async function cancelAppointment(id: string) {
  return prisma.appointment.update({ where: { id }, data: { status: "cancelled" } });
}

export interface RescheduleAppointmentParams {
  id: string;
  newDate: string;
  newStartTime: string;
  durationMinutes: number;
  // Tres estados distintos, a propósito:
  // - campo ausente (undefined): sin preferencia explícita → se intenta
  //   mantener el resourceId que el turno ya tenía (o auto-asignar si no
  //   tenía ninguno). Es el caso de WhatsApp, que no tiene forma de elegir.
  // - null: pedido EXPLÍCITO de "asignar automáticamente" ignorando el
  //   recurso actual (el dueño tocó esa opción en el dashboard).
  // - string: un recurso puntual elegido a mano.
  resourceId?: string | null;
}

export async function rescheduleAppointment(params: RescheduleAppointmentParams) {
  try {
    const appointment = await prisma.$transaction(async (tx) => {
      const current = await tx.appointment.findUnique({ where: { id: params.id } });
      if (!current) throw new AppointmentNotFoundError();

      const preferredResourceId = params.resourceId !== undefined ? params.resourceId : current.resourceId;

      const { resourceId } = await resolveAssignment(tx, {
        businessId: current.businessId,
        serviceId: current.serviceId,
        date: params.newDate,
        startTime: params.newStartTime,
        preferredResourceId,
        excludeAppointmentId: params.id,
      });

      return tx.appointment.update({
        where: { id: params.id },
        data: {
          date: params.newDate,
          startTime: params.newStartTime,
          endTime: computeEndTime(params.newStartTime, params.durationMinutes),
          durationMinutes: params.durationMinutes,
          resourceId,
        },
      });
    });

    return { appointment };
  } catch (error) {
    if (error instanceof AppointmentNotFoundError) return { error: "not_found" as const };
    const bookingError = toBookingError(error);
    if (bookingError) return bookingError;
    throw error;
  }
}

// serviceId es opcional (compatibilidad hacia atrás: cualquier caller
// existente que no lo pase mantiene el chequeo de agenda general de
// siempre). Cuando se pasa y el servicio tiene recursos activos, un horario
// es "disponible" si AL MENOS UN recurso está libre en ese startTime.
// excludeAppointmentId: al reprogramar, el propio turno (todavía en su
// horario viejo hasta que se confirme el cambio) nunca debe aparecer como
// ocupando un slot — ni el suyo propio ni, por supuesto, ningún otro.
export async function getAvailableSlots(
  businessId: string,
  date: Date,
  schedule: BusinessSchedule,
  serviceId?: string | null,
  excludeAppointmentId?: string,
): Promise<string[]> {
  const dateStr = date.toISOString().split("T")[0];
  const allSlots = getSlotsForDate(date, schedule);
  if (!allSlots.length) return [];

  const excludeClause = excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {};

  try {
    const resources = serviceId ? await getActiveServiceResources(businessId, serviceId) : [];

    if (resources.length === 0) {
      const existing = await prisma.appointment.findMany({
        where: { businessId, date: dateStr, status: { in: [...ACTIVE_STATUSES] }, ...excludeClause },
        select: { startTime: true },
      });
      const taken = new Set(existing.map((a) => a.startTime));
      return allSlots.filter((s) => !taken.has(s));
    }

    const resourceIds = resources.map((r) => r.id);
    const existing = await prisma.appointment.findMany({
      where: {
        resourceId: { in: resourceIds },
        date: dateStr,
        status: { in: [...ACTIVE_STATUSES] },
        ...excludeClause,
      },
      select: { resourceId: true, startTime: true },
    });
    const takenByResource = new Map<string, Set<string>>();
    for (const a of existing) {
      if (!a.resourceId) continue;
      const set = takenByResource.get(a.resourceId) ?? new Set<string>();
      set.add(a.startTime);
      takenByResource.set(a.resourceId, set);
    }
    return allSlots.filter((slot) => resourceIds.some((id) => !takenByResource.get(id)?.has(slot)));
  } catch {
    // DB no disponible — mismo fallback que ya existía: mostrar los horarios
    // del schedule sin filtrar en vez de romper toda la conversación.
    return allSlots;
  }
}

// Desglose por recurso para un horario puntual — lo usa el diálogo de
// "Agendar turno" y el de "Reprogramar" del dashboard para mostrar qué
// recurso concreto está libre/ocupado cuando el dueño quiere elegir a mano
// en vez de "asignar automáticamente". excludeAppointmentId: mismo motivo
// que en getAvailableSlots (el propio turno no es su propio conflicto).
export async function getResourceAvailabilityForSlot(
  businessId: string,
  serviceId: string,
  dateStr: string,
  startTime: string,
  excludeAppointmentId?: string,
): Promise<{ id: string; name: string; available: boolean }[]> {
  const resources = await getActiveServiceResources(businessId, serviceId);
  if (resources.length === 0) return [];

  const resourceIds = resources.map((r) => r.id);
  const existing = await prisma.appointment.findMany({
    where: {
      resourceId: { in: resourceIds },
      date: dateStr,
      startTime,
      status: { in: [...ACTIVE_STATUSES] },
      ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
    },
    select: { resourceId: true },
  });
  const taken = new Set(existing.map((a) => a.resourceId));
  return resources.map((r) => ({ id: r.id, name: r.name, available: !taken.has(r.id) }));
}

export async function findByCustomerPhone(businessId: string, phone: string) {
  return prisma.appointment.findMany({
    where: { businessId, customerPhone: phone, status: { in: [...ACTIVE_STATUSES] } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

export async function getAppointmentStats(businessId: string) {
  const today = new Date().toISOString().split("T")[0];

  const [todayCount, upcoming] = await Promise.all([
    prisma.appointment.count({
      where: { businessId, date: today, status: { in: [...ACTIVE_STATUSES] } },
    }),
    prisma.appointment.findFirst({
      where: {
        businessId,
        status: { in: [...ACTIVE_STATUSES] },
        OR: [
          { date: { gt: today } },
          { date: today },
        ],
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
  ]);

  return { todayCount, upcoming };
}
