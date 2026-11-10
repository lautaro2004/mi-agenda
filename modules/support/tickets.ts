import { prisma } from "@/lib/prisma";

// ── Pedidos de ayuda (soporte) ────────────────────────────────────────────
// Los crea Nodo a través de la API interna (/api/internal/nodo/support) y los
// administra Superadmin. Nunca se guardan datos de pago ni credenciales: solo
// el texto que escribe la persona y la ruta de la página donde estaba.

export const TICKET_STATUSES = ["open", "in_progress", "resolved"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_RATE_LIMIT = 5; // por persona y por hora
const HOUR_MS = 60 * 60 * 1000;

export type CreateTicketResult = { ok: true; id: string } | { ok: false; error: "NO_BUSINESS" | "RATE_LIMITED" };

export async function createSupportTicket(input: {
  userId: string;
  subject?: string | null;
  message: string;
  pagePath?: string | null;
  userAgent?: string | null;
  product?: string;
}): Promise<CreateTicketResult> {
  const membership = await prisma.membership.findFirst({
    where: { userId: input.userId },
    orderBy: { createdAt: "asc" },
    select: { businessId: true },
  });
  if (!membership) return { ok: false, error: "NO_BUSINESS" };
  const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { name: true, email: true } });
  if (!user) return { ok: false, error: "NO_BUSINESS" };

  const recent = await prisma.supportTicket.count({ where: { userId: input.userId, createdAt: { gte: new Date(Date.now() - HOUR_MS) } } });
  if (recent >= TICKET_RATE_LIMIT) return { ok: false, error: "RATE_LIMITED" };

  const ticket = await prisma.supportTicket.create({
    data: {
      businessId: membership.businessId,
      userId: input.userId,
      userName: user.name,
      userEmail: user.email,
      product: input.product ?? "nodo",
      subject: input.subject?.trim() || null,
      message: input.message.trim(),
      pagePath: input.pagePath?.slice(0, 300) || null,
      userAgent: input.userAgent?.slice(0, 300) || null,
    },
    select: { id: true },
  });
  return { ok: true, id: ticket.id };
}

export interface TicketRow {
  id: string;
  businessId: string;
  businessName: string;
  userName: string;
  userEmail: string;
  product: string;
  subject: string | null;
  message: string;
  pagePath: string | null;
  userAgent: string | null;
  status: TicketStatus;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export async function listSupportTickets(status?: TicketStatus): Promise<TicketRow[]> {
  const tickets = await prisma.supportTicket.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const businesses = await prisma.business.findMany({
    where: { id: { in: [...new Set(tickets.map((t) => t.businessId))] } },
    select: { id: true, name: true },
  });
  const names = new Map(businesses.map((b) => [b.id, b.name]));
  return tickets.map((t) => ({
    id: t.id,
    businessId: t.businessId,
    businessName: names.get(t.businessId) ?? "(negocio eliminado)",
    userName: t.userName,
    userEmail: t.userEmail,
    product: t.product,
    subject: t.subject,
    message: t.message,
    pagePath: t.pagePath,
    userAgent: t.userAgent,
    status: (TICKET_STATUSES as readonly string[]).includes(t.status) ? (t.status as TicketStatus) : "open",
    adminNote: t.adminNote,
    createdAt: t.createdAt.toISOString(),
    resolvedAt: t.resolvedAt ? t.resolvedAt.toISOString() : null,
  }));
}

export async function updateSupportTicket(id: string, input: { status?: TicketStatus; adminNote?: string | null }): Promise<boolean> {
  const existing = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return false;
  await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(input.status ? { status: input.status, resolvedAt: input.status === "resolved" ? new Date() : null } : {}),
      ...(input.adminNote !== undefined ? { adminNote: input.adminNote?.trim() || null } : {}),
    },
  });
  return true;
}
