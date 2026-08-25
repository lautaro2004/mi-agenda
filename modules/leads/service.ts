import { prisma } from "@/lib/prisma";
import type { LeadGoal, LeadMonthlyVolume, LeadStatus } from "@/lib/types";
import { suggestPlanSlug } from "@/modules/leads/suggest-plan";

// Único punto que escribe Lead — tanto el endpoint público (crea) como
// Superadmin (lista/actualiza) pasan por acá, nunca reimplementan la query.

// ── Alta pública (sección 3/5 del pedido) ────────────────────────────────
// A propósito un tipo separado de LeadUpdateValues/lo que acepta Superadmin:
// nunca incluye status/notes/suggestedPlan — ni por error un caller podría
// setearlos desde el formulario público, porque el tipo ni los tiene.
export interface CreateLeadInput {
  name: string;
  businessName: string;
  whatsapp: string;
  email: string;
  industry: string;
  goals: LeadGoal[];
  monthlyVolume?: LeadMonthlyVolume;
  message?: string;
  wantsMeeting: boolean;
}

export async function createLead(input: CreateLeadInput) {
  const suggestedPlan = suggestPlanSlug(input.goals);

  return prisma.lead.create({
    data: {
      name: input.name,
      businessName: input.businessName,
      whatsapp: input.whatsapp,
      email: input.email,
      industry: input.industry,
      goals: input.goals,
      monthlyVolume: input.monthlyVolume ?? null,
      message: input.message || null,
      wantsMeeting: input.wantsMeeting,
      suggestedPlan,
    },
  });
}

// ── Superadmin ────────────────────────────────────────────────────────────

export interface LeadFilters {
  status?: LeadStatus;
  suggestedPlan?: string;
  industry?: string;
  q?: string;
  from?: Date;
  to?: Date;
}

export async function listLeads(filters: LeadFilters = {}) {
  return prisma.lead.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.suggestedPlan ? { suggestedPlan: filters.suggestedPlan } : {}),
      ...(filters.industry ? { industry: filters.industry } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
      ...(filters.q
        ? {
            OR: [
              { name: { contains: filters.q, mode: "insensitive" as const } },
              { businessName: { contains: filters.q, mode: "insensitive" as const } },
              { email: { contains: filters.q, mode: "insensitive" as const } },
              { whatsapp: { contains: filters.q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
}

export interface LeadMetrics {
  newCount: number;
  contactedCount: number;
  meetingCount: number;
  convertedCount: number;
}

// "Nuevos / Contactados / Reuniones / Convertidos" (sección 6 del pedido) —
// 4 counts puntuales, no una agregación genérica por todos los estados: es
// justo lo que pide el tablero, ni más ni menos.
export async function getLeadMetrics(): Promise<LeadMetrics> {
  const [newCount, contactedCount, meetingCount, convertedCount] = await Promise.all([
    prisma.lead.count({ where: { status: "NEW" } }),
    prisma.lead.count({ where: { status: "CONTACTED" } }),
    prisma.lead.count({ where: { status: "MEETING" } }),
    prisma.lead.count({ where: { status: "CONVERTED" } }),
  ]);
  return { newCount, contactedCount, meetingCount, convertedCount };
}

export async function getLeadDetail(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: { convertedBusiness: { select: { id: true, name: true, slug: true } } },
  });
}

export interface UpdateLeadInput {
  status?: LeadStatus;
  notes?: string | null;
  meetingAt?: Date | null;
  convertedBusinessId?: string | null;
}

// Único punto de seguimiento (sección 7 del pedido: contactado, reunión,
// propuesta, convertido, notas — todo pasa por acá, un solo PATCH). Nunca
// toca name/businessName/whatsapp/email/goals/etc: eso es el contacto
// original del lead, esto es solo seguimiento interno.
export async function updateLead(id: string, data: UpdateLeadInput) {
  const existing = await prisma.lead.findUnique({ where: { id } });
  if (!existing) return null;

  const now = new Date();
  const updateData: {
    status?: LeadStatus;
    notes?: string | null;
    meetingAt?: Date | null;
    convertedBusinessId?: string | null;
    contactedAt?: Date;
    convertedAt?: Date;
  } = {};

  if (data.status !== undefined) {
    updateData.status = data.status;
    // Timestamps de hito: se completan la PRIMERA vez que se entra a ese
    // estado (nunca se pisan si el lead vuelve a pasar por el mismo estado
    // o retrocede y avanza de nuevo).
    if (data.status === "CONTACTED" && !existing.contactedAt) updateData.contactedAt = now;
    if (data.status === "CONVERTED" && !existing.convertedAt) updateData.convertedAt = now;
  }

  if (data.notes !== undefined) updateData.notes = data.notes;

  if (data.meetingAt !== undefined) {
    updateData.meetingAt = data.meetingAt;
    // "Coordinar reunión" es la acción real (sección 8 del pedido) — guardar
    // una fecha de reunión mueve el pipeline a MEETING, salvo que el caller
    // ya esté pidiendo otro estado explícito en la misma llamada.
    if (data.meetingAt && data.status === undefined) updateData.status = "MEETING";
  }

  if (data.convertedBusinessId !== undefined) {
    updateData.convertedBusinessId = data.convertedBusinessId;
  }

  return prisma.lead.update({ where: { id }, data: updateData });
}
