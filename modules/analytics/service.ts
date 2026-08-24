import { prisma } from "@/lib/prisma";
import { getAiUsageSummary } from "@/lib/superadmin/queries";

// Estadísticas del propio negocio (gateadas por Plan.statsEnabled — ver
// modules/billing/subscription.ts). A propósito NO agrega tracking nuevo:
// todo sale de Appointment/PaymentProof/AiUsageEvent, que ya se escriben
// para otros fines (turnos reales, comprobantes reales, uso de IA real que
// ya se muestra en Superadmin). Esto es solo una lectura agregada nueva para
// que el propio dueño la vea, sin duplicar ninguna fuente de verdad.

export interface AppointmentStats {
  total: number;
  confirmed: number;
  cancelled: number;
  awaitingPayment: number;
}

export interface ProofStats {
  received: number;
  approved: number;
  rejected: number;
  pending: number;
}

export interface ServiceBreakdownRow {
  serviceName: string;
  count: number;
}

export interface BusinessStats {
  from: string;
  to: string;
  appointments: AppointmentStats;
  proofs: ProofStats;
  aiUsage: { requests: number; totalTokens: number };
  byService: ServiceBreakdownRow[];
}

// depositAmount != null es lo mismo que usa el dashboard de Turnos para
// distinguir "requiere seña" (ver app/dashboard/turnos/page.tsx) — nunca se
// reinterpreta el status a mano.
const AWAITING_PAYMENT_STATUSES = ["pending_payment", "payment_submitted", "payment_rejected"];

export async function getBusinessStats(businessId: string, from: Date, to: Date): Promise<BusinessStats> {
  const [statusCounts, proofCounts, aiUsage, byServiceRows] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["status"],
      where: { businessId, createdAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    prisma.paymentProof.groupBy({
      by: ["status"],
      where: { businessId, uploadedAt: { gte: from, lte: to } },
      _count: { _all: true },
    }),
    getAiUsageSummary({ from, to, businessId }),
    prisma.appointment.groupBy({
      by: ["serviceName"],
      where: { businessId, createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      orderBy: { _count: { serviceName: "desc" } },
      take: 8,
    }),
  ]);

  const countByStatus = new Map(statusCounts.map((r) => [r.status, r._count._all]));
  const total = statusCounts.reduce((sum, r) => sum + r._count._all, 0);
  const awaitingPayment = AWAITING_PAYMENT_STATUSES.reduce((sum, s) => sum + (countByStatus.get(s) ?? 0), 0);

  const countByProofStatus = new Map(proofCounts.map((r) => [r.status, r._count._all]));

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    appointments: {
      total,
      confirmed: countByStatus.get("confirmed") ?? 0,
      cancelled: countByStatus.get("cancelled") ?? 0,
      awaitingPayment,
    },
    proofs: {
      received: proofCounts.reduce((sum, r) => sum + r._count._all, 0),
      approved: countByProofStatus.get("approved") ?? 0,
      rejected: countByProofStatus.get("rejected") ?? 0,
      pending: countByProofStatus.get("pending") ?? 0,
    },
    aiUsage: { requests: aiUsage.requests, totalTokens: aiUsage.totalTokens },
    byService: byServiceRows.map((r) => ({ serviceName: r.serviceName, count: r._count._all })),
  };
}
