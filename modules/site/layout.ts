import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getBookingIntent, resolveSiteTemplate } from "@/lib/booking-intent";
import {
  defaultSectionItems,
  normalizeSectionItems,
  validateLayoutItems,
  type LayoutValidation,
  type SectionItem,
} from "@/lib/site-sections";
import type { SiteBanner, SiteTemplate } from "@/lib/types";
import { toClientBanner } from "@/modules/site/banners";
import { revalidatePublicSite } from "@/modules/site/revalidate";

// Plantilla EFECTIVA del sitio (la misma regla que usa /s/[slug]): la manual
// del dueño o la auto-detectada según sus servicios.
export function effectiveTemplate(siteTemplate: SiteTemplate | null, services: Parameters<typeof getBookingIntent>[0]): SiteTemplate {
  return resolveSiteTemplate(siteTemplate, getBookingIntent(services));
}

export async function getLayoutItems(businessId: string, template: SiteTemplate, bannerIds: ReadonlySet<string>): Promise<SectionItem[]> {
  const row = await prisma.siteLayout.findUnique({ where: { businessId_template: { businessId, template } } });
  return normalizeSectionItems(template, row?.items, bannerIds);
}

export interface PublicLayout {
  items: SectionItem[];
  banners: Map<string, SiteBanner>;
}

// Lo que consume el sitio público: orden/visibilidad + banners ACTIVOS. Un
// banner inactivo se trata como inexistente (no se renderiza). Una sola
// ronda de queries; si algo falla, quien llama cae al orden de fábrica.
export async function loadPublicLayout(businessId: string, template: SiteTemplate): Promise<PublicLayout> {
  const [row, bannerRows] = await Promise.all([
    prisma.siteLayout.findUnique({ where: { businessId_template: { businessId, template } } }),
    prisma.siteBanner.findMany({ where: { businessId, active: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const banners = new Map(bannerRows.map((b) => [b.id, toClientBanner(b)]));
  return { items: normalizeSectionItems(template, row?.items, new Set(banners.keys())), banners };
}

export function fallbackPublicLayout(template: SiteTemplate): PublicLayout {
  return { items: defaultSectionItems(template), banners: new Map() };
}

// Reemplaza el orden/visibilidad completo en UNA escritura (upsert): el
// arreglo se valida entero antes de tocar la base, así nunca quedan
// posiciones inconsistentes ni banners de otro negocio.
export async function saveLayout(
  businessId: string,
  template: SiteTemplate,
  items: SectionItem[]
): Promise<LayoutValidation> {
  const bannerRows = await prisma.siteBanner.findMany({ where: { businessId }, select: { id: true } });
  const validation = validateLayoutItems(template, items, new Set(bannerRows.map((b) => b.id)));
  if (!validation.ok) return validation;

  const json = validation.items as unknown as Prisma.InputJsonValue;
  await prisma.siteLayout.upsert({
    where: { businessId_template: { businessId, template } },
    update: { items: json },
    create: { businessId, template, items: json },
  });
  await revalidatePublicSite(businessId);
  return validation;
}
