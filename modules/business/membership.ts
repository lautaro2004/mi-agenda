import { prisma } from "@/lib/prisma";
import { ensureBaseSubscription } from "@/modules/billing/subscription";

export async function ensureOwnerMembership(userId: string, businessName: string): Promise<string> {
  const existing = await prisma.membership.findFirst({ where: { userId } });
  if (existing) return existing.businessId;

  const business = await prisma.business.create({ data: { name: businessName } });
  await prisma.membership.create({ data: { userId, businessId: business.id, role: "owner" } });
  // Todo negocio nuevo arranca con una Subscription real (nivel base
  // "Agenda interna") — nunca queda dependiendo del fallback legacy de
  // ai-limits.ts, que es solo para datos preexistentes a este sistema.
  await ensureBaseSubscription(business.id);

  return business.id;
}
