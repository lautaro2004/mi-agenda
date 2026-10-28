import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  ASSET_LIMITS,
  SITE_ASSETS_BUCKET,
  ensureBucketExists,
  extractAssetPath,
  getPublicAssetUrl,
  uploadSiteAsset,
} from "@/lib/site-assets";
import { bannerInputSchema, canonicalCtaValue, isOwnBannerAssetPath, type BannerInput } from "@/lib/site-banners";
import type { SiteBanner, SiteBannerCtaType, SiteBannerVariant } from "@/lib/types";
import { revalidatePublicSite } from "@/modules/site/revalidate";

export class BannerValidationError extends Error {}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

type BannerRow = {
  id: string;
  businessId: string;
  name: string;
  variant: string;
  desktopImageUrl: string;
  mobileImageUrl: string | null;
  imageAlt: string;
  title: string | null;
  description: string | null;
  active: boolean;
  ctaType: string | null;
  ctaLabel: string | null;
  ctaValue: string | null;
};

export function toClientBanner(row: BannerRow): SiteBanner {
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    variant: (row.variant === "image" || row.variant === "compact" ? row.variant : "text") as SiteBannerVariant,
    desktopImageUrl: row.desktopImageUrl,
    mobileImageUrl: row.mobileImageUrl,
    imageAlt: row.imageAlt,
    title: row.title,
    description: row.description,
    active: row.active,
    cta:
      row.ctaType && row.ctaLabel
        ? { type: row.ctaType as SiteBannerCtaType, label: row.ctaLabel, value: row.ctaValue }
        : null,
  };
}

export async function listBanners(businessId: string): Promise<SiteBanner[]> {
  const rows = await prisma.siteBanner.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } });
  return rows.map(toClientBanner);
}

// Solo lo que muestra el sitio público: banners activos del negocio.
export async function listActiveBanners(businessId: string): Promise<SiteBanner[]> {
  const rows = await prisma.siteBanner.findMany({ where: { businessId, active: true }, orderBy: { createdAt: "asc" } });
  return rows.map(toClientBanner);
}

function ownAssetPath(businessId: string, url: string | null): string | null {
  if (!url) return null;
  const path = extractAssetPath(url);
  return isOwnBannerAssetPath(path, businessId) ? path : null;
}

// Validación de negocio que no se puede hacer en el schema puro: las
// imágenes tienen que ser archivos subidos por ESTE negocio y el CTA tiene
// que poder cumplirse con los datos reales del negocio (no se inventan
// números: WhatsApp y teléfono salen de la configuración del negocio).
async function validateInput(businessId: string, input: BannerInput): Promise<void> {
  if (!ownAssetPath(businessId, input.desktopImageUrl)) {
    throw new BannerValidationError("La imagen de escritorio no es válida. Volvé a subirla.");
  }
  if (input.mobileImageUrl && !ownAssetPath(businessId, input.mobileImageUrl)) {
    throw new BannerValidationError("La imagen móvil no es válida. Volvé a subirla.");
  }

  const cta = input.cta;
  if (cta?.type === "whatsapp" || cta?.type === "phone") {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { whatsappNumber: true, phone: true },
    });
    if (cta.type === "whatsapp" && !business?.whatsappNumber?.replace(/[^0-9]/g, "")) {
      throw new BannerValidationError("Para usar WhatsApp como destino, primero cargá el número de WhatsApp de tu negocio.");
    }
    if (cta.type === "phone" && !business?.phone?.replace(/[^0-9]/g, "")) {
      throw new BannerValidationError("Para usar una llamada como destino, primero cargá el teléfono de tu negocio.");
    }
  }
}

function toData(input: BannerInput) {
  const cta = input.cta;
  return {
    name: input.name,
    variant: input.variant,
    desktopImageUrl: input.desktopImageUrl,
    mobileImageUrl: input.mobileImageUrl,
    imageAlt: input.imageAlt,
    title: input.title,
    description: input.description,
    active: input.active,
    ctaType: cta ? cta.type : null,
    ctaLabel: cta ? cta.label : null,
    ctaValue: cta ? canonicalCtaValue(cta) : null,
  };
}

export function parseBannerInput(body: unknown): { ok: true; data: BannerInput } | { ok: false; error: string } {
  const parsed = bannerInputSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos de banner inválidos." };
  }
  return { ok: true, data: parsed.data };
}

async function removeFiles(paths: (string | null)[]): Promise<void> {
  const clean = paths.filter((p): p is string => !!p);
  if (clean.length === 0) return;
  const { error } = await getSupabaseAdmin().storage.from(SITE_ASSETS_BUCKET).remove(clean);
  if (error) {
    // Nunca tira abajo la operación principal: el archivo queda huérfano
    // para el barrido periódico (mismo criterio que la galería).
    console.error("[banners] No pudimos borrar archivos de Storage:", error);
  }
}

export async function createBanner(businessId: string, input: BannerInput): Promise<SiteBanner> {
  await validateInput(businessId, input);
  const row = await prisma.siteBanner.create({ data: { businessId, ...toData(input) } });
  await revalidatePublicSite(businessId);
  return toClientBanner(row);
}

export async function updateBanner(businessId: string, id: string, input: BannerInput): Promise<SiteBanner | null> {
  const existing = await prisma.siteBanner.findFirst({ where: { id, businessId } });
  if (!existing) return null;
  await validateInput(businessId, input);

  // updateMany con businessId: aunque alguien adivine un id, no toca banners ajenos.
  const result = await prisma.siteBanner.updateMany({ where: { id, businessId }, data: toData(input) });
  if (result.count === 0) return null;

  // Imágenes reemplazadas: se borran recién después de guardar el banner nuevo.
  const replaced = [existing.desktopImageUrl, existing.mobileImageUrl].filter(
    (url): url is string => !!url && url !== input.desktopImageUrl && url !== input.mobileImageUrl
  );
  await removeFiles(replaced.map((url) => ownAssetPath(businessId, url)));

  const row = await prisma.siteBanner.findUniqueOrThrow({ where: { id } });
  await revalidatePublicSite(businessId);
  return toClientBanner(row);
}

export async function setBannerActive(businessId: string, id: string, active: boolean): Promise<SiteBanner | null> {
  const result = await prisma.siteBanner.updateMany({ where: { id, businessId }, data: { active } });
  if (result.count === 0) return null;
  const row = await prisma.siteBanner.findUniqueOrThrow({ where: { id } });
  await revalidatePublicSite(businessId);
  return toClientBanner(row);
}

// Borra el banner Y sus referencias en el orden de las páginas (una sola
// transacción: nunca queda una posición apuntando a un banner inexistente).
export async function deleteBanner(businessId: string, id: string): Promise<boolean> {
  const banner = await prisma.siteBanner.findFirst({ where: { id, businessId } });
  if (!banner) return false;

  const layouts = await prisma.siteLayout.findMany({ where: { businessId } });
  const layoutUpdates = layouts.flatMap((layout) => {
    const items = Array.isArray(layout.items) ? (layout.items as { bannerId?: string }[]) : [];
    const kept = items.filter((item) => item?.bannerId !== id);
    return kept.length === items.length
      ? []
      : [prisma.siteLayout.update({ where: { id: layout.id }, data: { items: kept as object[] } })];
  });

  await prisma.$transaction([...layoutUpdates, prisma.siteBanner.deleteMany({ where: { id, businessId } })]);

  await removeFiles([ownAssetPath(businessId, banner.desktopImageUrl), ownAssetPath(businessId, banner.mobileImageUrl)]);
  await revalidatePublicSite(businessId);
  return true;
}

// Sube una imagen de banner SIN guardarla todavía en ningún banner: el
// diálogo la previsualiza y recién al "Guardar" queda asociada. Si el dueño
// cancela o la reemplaza, el cliente llama a discardBannerImage.
export async function uploadBannerImage(
  businessId: string,
  file: { bytes: Buffer; mimeType: string; size: number }
): Promise<string> {
  const limits = ASSET_LIMITS.banner;
  if (!limits.mimeTypes.includes(file.mimeType)) {
    const formats = limits.mimeTypes.map((m) => m.split("/")[1].toUpperCase()).join(", ");
    throw new BannerValidationError(`Formato no permitido. Usá ${formats}.`);
  }
  if (file.size > limits.maxBytes) {
    throw new BannerValidationError(`El archivo supera el máximo de ${Math.round(limits.maxBytes / (1024 * 1024))} MB.`);
  }

  await ensureBucketExists();
  const path = `${businessId}/banner/${crypto.randomUUID()}.${EXTENSION_BY_MIME[file.mimeType] ?? "bin"}`;
  await uploadSiteAsset(path, file.bytes, file.mimeType);
  return getPublicAssetUrl(path);
}

// Descarta una imagen subida y no guardada. Nunca borra una imagen que ya
// usa algún banner (ni de otro negocio: el path tiene que ser del propio).
export async function discardBannerImage(businessId: string, url: string): Promise<boolean> {
  const path = ownAssetPath(businessId, url);
  if (!path) return false;
  const inUse = await prisma.siteBanner.findFirst({
    where: { businessId, OR: [{ desktopImageUrl: url }, { mobileImageUrl: url }] },
    select: { id: true },
  });
  if (inUse) return false;
  await removeFiles([path]);
  return true;
}
