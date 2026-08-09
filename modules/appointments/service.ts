import { prisma } from "@/lib/prisma";
import type { BusinessSchedule } from "@/lib/types";
import { getSlotsForDate } from "@/modules/ai/booking/flow";

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
}

function computeEndTime(startTime: string, durationMinutes: number): string {
  const [h, m] = startTime.split(":").map(Number);
  const end = h * 60 + m + durationMinutes;
  return `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

export async function createAppointment(params: CreateAppointmentParams) {
  await prisma.business.upsert({
    where: { id: params.businessId },
    update: { name: params.businessName },
    create: { id: params.businessId, name: params.businessName },
  });

  const conflict = await prisma.appointment.findFirst({
    where: {
      businessId: params.businessId,
      date: params.date,
      startTime: params.startTime,
      status: { in: ["pending", "confirmed"] },
    },
  });

  if (conflict) return { error: "slot_taken" as const };

  const appointment = await prisma.appointment.create({
    data: {
      businessId: params.businessId,
      serviceId: params.serviceId,
      serviceName: params.serviceName,
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

  return { appointment };
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

export async function rescheduleAppointment(
  id: string,
  newDate: string,
  newStartTime: string,
  durationMinutes: number,
) {
  return prisma.appointment.update({
    where: { id },
    data: {
      date: newDate,
      startTime: newStartTime,
      endTime: computeEndTime(newStartTime, durationMinutes),
    },
  });
}

export async function getAvailableSlots(
  businessId: string,
  date: Date,
  schedule: BusinessSchedule,
): Promise<string[]> {
  const dateStr = date.toISOString().split("T")[0];
  const allSlots = getSlotsForDate(date, schedule);
  if (!allSlots.length) return [];

  try {
    const existing = await prisma.appointment.findMany({
      where: { businessId, date: dateStr, status: { in: ["pending", "confirmed"] } },
      select: { startTime: true },
    });
    const taken = new Set(existing.map((a) => a.startTime));
    return allSlots.filter((s) => !taken.has(s));
  } catch {
    // DB not available — return schedule-based slots without conflict check
    return allSlots;
  }
}

export async function findByCustomerPhone(businessId: string, phone: string) {
  return prisma.appointment.findMany({
    where: { businessId, customerPhone: phone, status: { in: ["pending", "confirmed"] } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
}

export async function getAppointmentStats(businessId: string) {
  const today = new Date().toISOString().split("T")[0];

  const [todayCount, upcoming] = await Promise.all([
    prisma.appointment.count({
      where: { businessId, date: today, status: { in: ["pending", "confirmed"] } },
    }),
    prisma.appointment.findFirst({
      where: {
        businessId,
        status: { in: ["pending", "confirmed"] },
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
