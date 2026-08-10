import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const businesses = await prisma.business.findMany({
    where: { slug: { not: null } },
    select: { slug: true, updatedAt: true },
  });

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "monthly" },
    ...businesses.map((b) => ({
      url: `${SITE_URL}/s/${b.slug}`,
      lastModified: b.updatedAt,
      changeFrequency: "weekly" as const,
    })),
  ];
}
