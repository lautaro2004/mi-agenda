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

export class AvatarValidationError extends Error {}

function validateImage(mimeType: string, size: number): void {
  const limits = ASSET_LIMITS.avatar;
  if (!limits.mimeTypes.includes(mimeType)) {
    throw new AvatarValidationError("Formato no permitido. Usá PNG, JPG o WEBP.");
  }
  if (size > limits.maxBytes) {
    throw new AvatarValidationError(`El archivo supera el máximo de ${Math.round(limits.maxBytes / (1024 * 1024))} MB.`);
  }
  if (size === 0) {
    throw new AvatarValidationError("El archivo llegó vacío o dañado.");
  }
}

// Solo Storage acá a propósito (subir/borrar el archivo) — nunca escribe
// User.image directamente: eso lo hace el cliente vía authClient.updateUser()
// junto con el resto del formulario de perfil (mismo patrón que
// LogoUploader/AssetUploader: el uploader solo devuelve una URL, el submit
// del formulario es quien la persiste).
export async function replaceUserAvatar(
  userId: string,
  file: { bytes: Buffer; mimeType: string; size: number }
): Promise<string> {
  validateImage(file.mimeType, file.size);
  await ensureBucketExists();

  const current = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
  const previousUrl = current?.image ?? null;

  const path = buildAssetPath(userId, "avatar", file.mimeType);
  await uploadSiteAsset(path, file.bytes, file.mimeType);
  const url = getPublicAssetUrl(path);

  const previousPath = extractAssetPath(previousUrl);
  if (previousPath) {
    try {
      await deleteSiteAsset(previousPath);
    } catch (error) {
      console.error(`[account] No pudimos borrar el avatar anterior (user ${userId}, path ${previousPath}):`, error);
    }
  }

  return url;
}

export async function removeUserAvatar(userId: string): Promise<void> {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: { image: true } });
  const previousPath = extractAssetPath(current?.image ?? null);
  if (previousPath) {
    await deleteSiteAsset(previousPath);
  }
}
