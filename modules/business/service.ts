import { prisma } from "@/lib/prisma";
import { defaultSchedule } from "@/lib/mock-data";
import { WEEK_DAYS } from "@/lib/types";
import type { Business, BusinessSchedule, FAQ, Service } from "@/lib/types";
import type { ServiceFormValues, BusinessInfoValues, FaqFormValues } from "@/lib/schemas";

function toClientBusiness(
  businessId: string,
  row: Awaited<ReturnType<typeof prisma.business.findUnique>>
): Business {
  return {
    id: businessId,
    name: row?.name ?? "",
    logoUrl: row?.logoUrl ?? null,
    category: (row?.category as Business["category"]) ?? "",
    description: row?.description ?? "",
    phone: row?.phone ?? "",
    whatsappNumber: row?.whatsappNumber ?? "",
    address: row?.address ?? "",
    instagramUrl: row?.instagramUrl ?? "",
    facebookUrl: row?.facebookUrl ?? "",
  };
}

function toClientSchedule(
  rows: Awaited<ReturnType<typeof prisma.schedule.findMany>>
): BusinessSchedule {
  const byDay = new Map(rows.map((row) => [row.day, row]));

  return WEEK_DAYS.map(({ id }) => {
    const row = byDay.get(id);
    const fallback = defaultSchedule.find((day) => day.day === id)!;
    if (!row) return fallback;

    return {
      day: id,
      enabled: row.enabled,
      openTime: row.openTime,
      closeTime: row.closeTime,
      hasBreak: row.hasBreak,
      breakStart: row.breakStart ?? fallback.breakStart,
      breakEnd: row.breakEnd ?? fallback.breakEnd,
    };
  });
}

function toClientService(row: {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  category: string | null;
  durationMinutes: number;
  price: number;
}): Service {
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    description: row.description ?? "",
    category: (row.category as Service["category"]) ?? "",
    durationMinutes: row.durationMinutes,
    price: row.price,
  };
}

function toClientFaq(row: { id: string; businessId: string; question: string; answer: string }): FAQ {
  return { id: row.id, businessId: row.businessId, question: row.question, answer: row.answer };
}

export async function getBusinessState(businessId: string) {
  const [business, scheduleRows, serviceRows, faqRows] = await Promise.all([
    prisma.business.findUnique({ where: { id: businessId } }),
    prisma.schedule.findMany({ where: { businessId } }),
    prisma.service.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
    prisma.fAQ.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
  ]);

  return {
    business: toClientBusiness(businessId, business),
    schedule: toClientSchedule(scheduleRows),
    services: serviceRows.map(toClientService),
    faqs: faqRows.map(toClientFaq),
  };
}

export async function updateBusinessInfo(businessId: string, data: Partial<BusinessInfoValues>) {
  const row = await prisma.business.upsert({
    where: { id: businessId },
    update: data,
    create: { ...data, id: businessId, name: data.name ?? "" },
  });

  return toClientBusiness(businessId, row);
}

export async function replaceSchedule(businessId: string, schedule: BusinessSchedule) {
  await prisma.$transaction(
    schedule.map((day) =>
      prisma.schedule.upsert({
        where: { businessId_day: { businessId, day: day.day } },
        update: {
          enabled: day.enabled,
          openTime: day.openTime,
          closeTime: day.closeTime,
          hasBreak: day.hasBreak,
          breakStart: day.breakStart,
          breakEnd: day.breakEnd,
        },
        create: {
          businessId,
          day: day.day,
          enabled: day.enabled,
          openTime: day.openTime,
          closeTime: day.closeTime,
          hasBreak: day.hasBreak,
          breakStart: day.breakStart,
          breakEnd: day.breakEnd,
        },
      })
    )
  );

  const rows = await prisma.schedule.findMany({ where: { businessId } });
  return toClientSchedule(rows);
}

export async function createService(businessId: string, data: ServiceFormValues) {
  const row = await prisma.service.create({ data: { businessId, ...data } });
  return toClientService(row);
}

export async function updateService(businessId: string, id: string, data: ServiceFormValues) {
  const result = await prisma.service.updateMany({ where: { id, businessId }, data });
  if (result.count === 0) return null;
  const row = await prisma.service.findUniqueOrThrow({ where: { id } });
  return toClientService(row);
}

export async function deleteService(businessId: string, id: string) {
  const result = await prisma.service.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}

export async function createFaq(businessId: string, data: FaqFormValues) {
  const row = await prisma.fAQ.create({ data: { businessId, ...data } });
  return toClientFaq(row);
}

export async function updateFaq(businessId: string, id: string, data: FaqFormValues) {
  const result = await prisma.fAQ.updateMany({ where: { id, businessId }, data });
  if (result.count === 0) return null;
  const row = await prisma.fAQ.findUniqueOrThrow({ where: { id } });
  return toClientFaq(row);
}

export async function deleteFaq(businessId: string, id: string) {
  const result = await prisma.fAQ.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}
