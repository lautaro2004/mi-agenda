import { prisma } from "@/lib/prisma";
import { updateBusinessInfo } from "@/modules/business/service";
import {
  ASSET_LIMITS,
  buildAssetPath,
  deleteSiteAsset,
  ensureBucketExists,
  extractAssetPath,
  getPublicAssetUrl,
  listSiteAssets,
  uploadSiteAsset,
  type SiteAssetKind,
} from "@/lib/site-assets";

export class AssetValidationError extends Error {}

function validate(kind: SiteAssetKind, mimeType: string, size: number): void {
  const limits = ASSET_LIMITS[kind];
  if (!limits.mimeTypes.includes(mimeType)) {
    const formats = limits.mimeTypes.map((m) => m.split("/")[1].toUpperCase()).join(", ");
    throw new AssetValidationError(`Formato no permitido. Usá ${formats}.`);
  }
  if (size > limits.maxBytes) {
    throw new AssetValidationError(`El archivo supera el máximo de ${Math.round(limits.maxBytes / (1024 * 1024))} MB.`);
  }
}

const FIELD_BY_KIND = {
  logo: "logoUrl",
  hero: "heroImageUrl",
} as const satisfies Record<SiteAssetKind, "logoUrl" | "heroImageUrl">;

// Reemplaza logo o hero de forma segura: sube el archivo nuevo, recién
// DESPUÉS actualiza la referencia en Postgres, y recién DESPUÉS borra el
// anterior — nunca al revés. Si el paso 2 (upload) falla, el archivo y la
// referencia anteriores quedan intactos. Si el paso 4 (borrado del anterior)
// falla, no hace fallar la operación: el archivo viejo queda huérfano y lo
// recoge cleanupOrphanSiteAssets() más tarde (ver sección 5/6 de la tarea).
export async function replaceSiteAsset(
  businessId: string,
  kind: SiteAssetKind,
  file: { bytes: Buffer; mimeType: string; size: number }
): Promise<string> {
  validate(kind, file.mimeType, file.size);
  await ensureBucketExists();

  const field = FIELD_BY_KIND[kind];
  const current = await prisma.business.findUnique({ where: { id: businessId } });
  const previousUrl = (current?.[field] as string | null | undefined) ?? null;

  const path = buildAssetPath(businessId, kind, file.mimeType);
  await uploadSiteAsset(path, file.bytes, file.mimeType);
  const url = getPublicAssetUrl(path);

  await updateBusinessInfo(businessId, field === "logoUrl" ? { logoUrl: url } : { heroImageUrl: url });

  const previousPath = extractAssetPath(previousUrl);
  if (previousPath) {
    try {
      await deleteSiteAsset(previousPath);
    } catch (error) {
      console.error(
        `[site-assets] No pudimos borrar el asset anterior (${kind}, business ${businessId}, path ${previousPath}) — queda huérfano para el barrido periódico.`,
        error
      );
    }
  }

  return url;
}

// "Quitar" desde el dashboard: misma precaución de orden (referencia primero,
// borrado del archivo después, nunca al revés).
export async function removeSiteAsset(businessId: string, kind: SiteAssetKind): Promise<void> {
  const field = FIELD_BY_KIND[kind];
  const current = await prisma.business.findUnique({ where: { id: businessId } });
  const previousUrl = (current?.[field] as string | null | undefined) ?? null;
  if (!previousUrl) return;

  await updateBusinessInfo(businessId, field === "logoUrl" ? { logoUrl: null } : { heroImageUrl: null });

  const previousPath = extractAssetPath(previousUrl);
  if (previousPath) {
    try {
      await deleteSiteAsset(previousPath);
    } catch (error) {
      console.error(
        `[site-assets] No pudimos borrar el asset quitado (${kind}, business ${businessId}, path ${previousPath}) — queda huérfano para el barrido periódico.`,
        error
      );
    }
  }
}

const ORPHAN_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

// Barrido de assets huérfanos (sección 6 de la tarea): nunca borra por
// antigüedad sola. Un objeto en Storage es candidato solo si (a) ningún
// Business lo referencia actualmente Y (b) tiene más de 7 días — el período
// de gracia cubre el caso normal donde el propio replaceSiteAsset() ya lo
// borró al toque; esto es la red de seguridad para cuando ESE borrado
// puntual falló. Pensada para invocarse periódicamente desde afuera (ver
// app/api/cron/cleanup-site-assets/route.ts) — el proyecto no tiene
// infraestructura de cron propia todavía, así que no se agrega una acá.
export async function cleanupOrphanSiteAssets(): Promise<{ checked: number; deleted: number }> {
  const businesses = await prisma.business.findMany({
    select: { id: true, logoUrl: true, heroImageUrl: true },
  });

  let checked = 0;
  let deleted = 0;
  const now = Date.now();
  const kinds: SiteAssetKind[] = ["logo", "hero"];

  for (const business of businesses) {
    for (const kind of kinds) {
      const objects = await listSiteAssets(business.id, kind);

      for (const object of objects) {
        checked++;
        const path = `${business.id}/${kind}/${object.name}`;

        const createdAt = object.createdAt ? new Date(object.createdAt).getTime() : 0;
        if (now - createdAt < ORPHAN_GRACE_PERIOD_MS) continue;

        // Revalidación justo antes de borrar: cierra la ventana entre el
        // findMany() de arriba y este punto (ej. un reemplazo que acaba de
        // volver a apuntar a este mismo path).
        const fresh = await prisma.business.findUnique({
          where: { id: business.id },
          select: { logoUrl: true, heroImageUrl: true },
        });
        const stillReferenced =
          extractAssetPath(fresh?.logoUrl) === path || extractAssetPath(fresh?.heroImageUrl) === path;
        if (stillReferenced) continue;

        try {
          await deleteSiteAsset(path);
          deleted++;
        } catch (error) {
          console.error(`[site-assets] Cleanup no pudo borrar ${path}:`, error);
        }
      }
    }
  }

  return { checked, deleted };
}
