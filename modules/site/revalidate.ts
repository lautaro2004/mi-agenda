import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

// El sitio público (/s/[slug]) se arma en cada request a partir de la base,
// pero igual se invalida su caché después de cambiar banners u orden de
// secciones: así el cambio se ve apenas se guarda, aunque la plataforma
// (ISR / CDN) haya cacheado la página. Nunca falla la operación principal.
export async function revalidatePublicSite(businessId: string): Promise<void> {
  try {
    const business = await prisma.business.findUnique({ where: { id: businessId }, select: { slug: true } });
    if (business?.slug) revalidatePath(`/s/${business.slug}`);
  } catch (error) {
    console.error("[site] No se pudo revalidar el sitio público:", error);
  }
}
