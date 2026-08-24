import { prisma } from "@/lib/prisma";
import {
  ASSET_LIMITS,
  buildAssetPath,
  deleteSiteAsset,
  ensureBucketExists,
  extractAssetPath,
  getPublicAssetUrl,
  uploadSiteAsset,
} from "@/lib/site-assets";

export class MenuValidationError extends Error {}

function validatePdf(mimeType: string, size: number): void {
  const limits = ASSET_LIMITS.menu;
  if (!limits.mimeTypes.includes(mimeType)) {
    throw new MenuValidationError("Solo se acepta un archivo PDF.");
  }
  if (size > limits.maxBytes) {
    throw new MenuValidationError(`El archivo supera el máximo de ${Math.round(limits.maxBytes / (1024 * 1024))} MB.`);
  }
  if (size === 0) {
    throw new MenuValidationError("El archivo llegó vacío o dañado.");
  }
}

export interface MenuState {
  menuEnabled: boolean;
  menuPdfUrl: string | null;
}

export async function getMenuState(businessId: string): Promise<MenuState> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { menuEnabled: true, menuPdfUrl: true },
  });
  return { menuEnabled: business?.menuEnabled ?? false, menuPdfUrl: business?.menuPdfUrl ?? null };
}

// Activar/desactivar es independiente de tener un PDF cargado (el dueño
// puede subirlo y dejarlo apagado hasta estar conforme) — la página pública
// y el QR (ver app/s/[slug]/carta/page.tsx) exigen AMBOS igual, así que
// activar sin PDF no expone nada roto, solo queda "activo pero sin URL
// pública real todavía".
export async function setMenuEnabled(businessId: string, enabled: boolean): Promise<MenuState> {
  const business = await prisma.business.update({
    where: { id: businessId },
    data: { menuEnabled: enabled },
    select: { menuEnabled: true, menuPdfUrl: true },
  });
  return { menuEnabled: business.menuEnabled, menuPdfUrl: business.menuPdfUrl };
}

// Mismo orden que replaceSiteAsset/replaceServiceImage: sube el archivo
// nuevo, recién DESPUÉS actualiza la referencia, recién DESPUÉS borra el
// anterior — nunca al revés.
export async function replaceMenuPdf(
  businessId: string,
  file: { bytes: Buffer; mimeType: string; size: number }
): Promise<MenuState> {
  validatePdf(file.mimeType, file.size);
  await ensureBucketExists();

  const current = await prisma.business.findUnique({ where: { id: businessId }, select: { menuPdfUrl: true } });
  const previousUrl = current?.menuPdfUrl ?? null;

  const path = buildAssetPath(businessId, "menu", file.mimeType);
  await uploadSiteAsset(path, file.bytes, file.mimeType);
  const url = getPublicAssetUrl(path);

  const business = await prisma.business.update({
    where: { id: businessId },
    data: { menuPdfUrl: url },
    select: { menuEnabled: true, menuPdfUrl: true },
  });

  const previousPath = extractAssetPath(previousUrl);
  if (previousPath) {
    try {
      await deleteSiteAsset(previousPath);
    } catch (error) {
      console.error(
        `[menu] No pudimos borrar el PDF anterior (business ${businessId}, path ${previousPath}) — queda huérfano para el barrido periódico.`,
        error
      );
    }
  }

  return { menuEnabled: business.menuEnabled, menuPdfUrl: business.menuPdfUrl };
}

// Quitar el PDF también apaga la carta: una carta "activa" sin PDF sería un
// estado confuso (la página pública y el QR dejarían de tener sentido) — se
// evita ese estado intermedio en vez de dejar que la UI tenga que
// contemplarlo en todos lados.
export async function removeMenuPdf(businessId: string): Promise<MenuState> {
  const current = await prisma.business.findUnique({ where: { id: businessId }, select: { menuPdfUrl: true } });
  const previousUrl = current?.menuPdfUrl ?? null;

  const business = await prisma.business.update({
    where: { id: businessId },
    data: { menuPdfUrl: null, menuEnabled: false },
    select: { menuEnabled: true, menuPdfUrl: true },
  });

  const previousPath = extractAssetPath(previousUrl);
  if (previousPath) {
    try {
      await deleteSiteAsset(previousPath);
    } catch (error) {
      console.error(
        `[menu] No pudimos borrar el PDF quitado (business ${businessId}, path ${previousPath}) — queda huérfano para el barrido periódico.`,
        error
      );
    }
  }

  return { menuEnabled: business.menuEnabled, menuPdfUrl: business.menuPdfUrl };
}
