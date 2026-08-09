import { prisma } from "@/lib/prisma";

export async function ensureOwnerMembership(userId: string, businessName: string): Promise<string> {
  const existing = await prisma.membership.findFirst({ where: { userId } });
  if (existing) return existing.businessId;

  const business = await prisma.business.create({ data: { name: businessName } });
  await prisma.membership.create({ data: { userId, businessId: business.id, role: "owner" } });

  return business.id;
}
