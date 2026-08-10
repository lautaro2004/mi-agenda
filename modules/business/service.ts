import { prisma } from "@/lib/prisma";
import { defaultSchedule } from "@/lib/mock-data";
import { WEEK_DAYS } from "@/lib/types";
import type { Business, BusinessSchedule, FAQ, Service } from "@/lib/types";
import type { ServiceFormValues, FaqFormValues } from "@/lib/schemas";
import type { Prisma } from "@prisma/client";

// Cliente de Prisma inyectable: por defecto el singleton de siempre, pero
// applyTrainingProposal() puede pasar un "tx" de prisma.$transaction() para
// que varias de estas llamadas (ej. 3 servicios + 1 FAQ en un mismo
// knowledge_batch) se confirmen o se reviertan todas juntas. Ningún otro
// caller pasa nada distinto de "prisma", así que esto no cambia el
// comportamiento de las rutas del dashboard.
type Db = Prisma.TransactionClient;

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

// Superset laxo de BusinessInfoValues: "category" es string libre en vez del
// enum cerrado, para que el mismo servicio sirva tanto al formulario del
// dashboard (siempre valida contra businessInfoSchema antes de llamar acá)
// como al flujo de entrenamiento (valida contra trainingBusinessUpdateSchema,
// que acepta cualquier rubro que el dueño describa). Prisma ya guarda
// "category" como texto libre, así que esto no relaja nada a nivel de datos.
export interface BusinessUpdateInput {
  name?: string;
  logoUrl?: string | null;
  category?: string;
  description?: string;
  phone?: string;
  whatsappNumber?: string;
  address?: string;
  instagramUrl?: string;
  facebookUrl?: string;
}

export async function updateBusinessInfo(businessId: string, data: BusinessUpdateInput, db: Db = prisma) {
  const row = await db.business.upsert({
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

// Superset laxo de ServiceFormValues: dos diferencias respecto del tipo del
// dashboard, mismo motivo en ambas — "category" es opcional y string libre
// en vez del enum cerrado SERVICE_CATEGORIES (ver BusinessUpdateInput más
// arriba), y "durationMinutes" es opcional porque no todo servicio es
// reservable por turno (ver isBookableService() debajo). El formulario del
// dashboard sigue validando contra serviceSchema (que SÍ exige duración)
// antes de llamar acá, así que esto no afecta esa vía.
export interface ServiceCreateInput {
  name: string;
  description?: string;
  category?: string;
  durationMinutes?: number;
  price: number;
}

// Upsert por (businessId, name) en vez de un create plano: esto es lo que
// hace que guardar un servicio sea idempotente. No es solo por reintentos de
// red o doble-click (eso ya lo bloquea el "disabled" del botón en el chat) —
// el caso real que motivó esto es que el turno de "continuación" automática
// del entrenamiento (ver CONTINUATION_MESSAGE en engine.ts) puede volver a
// proponer una sección que ya se cerró, con los mismos servicios. Sin esto,
// cada confirmación de esa propuesta repetida creaba una fila nueva. Con el
// unique constraint (ver schema.prisma), da igual cuántas veces se confirme
// "Landing Pages" para el mismo negocio: converge a una sola fila con los
// valores más recientes.
export async function createService(businessId: string, data: ServiceCreateInput | ServiceFormValues, db: Db = prisma) {
  const payload = { description: "", category: "", durationMinutes: 0, ...data };
  const row = await db.service.upsert({
    where: { businessId_name: { businessId, name: payload.name } },
    create: { businessId, ...payload },
    update: payload,
  });
  return toClientService(row);
}

// Reexportado desde lib/types.ts (no Prisma) para que también lo puedan usar
// componentes cliente como ServiceCard sin arrastrar el cliente de Prisma al
// bundle del browser. Los imports existentes desde "@/modules/business/service"
// (rule-engine.ts, booking/flow.ts) siguen funcionando igual.
export { isBookableService } from "@/lib/types";

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

export async function createFaq(businessId: string, data: FaqFormValues, db: Db = prisma) {
  const row = await db.fAQ.create({ data: { businessId, ...data } });
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
