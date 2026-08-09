import { headers } from "next/headers";

import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/prisma";

export async function getCurrentBusinessId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
  });

  return membership?.businessId ?? null;
}
