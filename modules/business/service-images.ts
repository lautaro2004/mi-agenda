import { prisma } from "@/lib/prisma";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ASSET_LIMITS, type SiteAssetKind } from "@/lib/asset-limits";
import { SITE_ASSETS_BUCKET, extractAssetPath, getPublicAssetUrl } from "@/lib/site-assets";

export class ServiceImageValidationError extends Error {}

const KIND: SiteAssetKind = "service";

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function validate(mimeType: string, size: number): void {
  const limits = ASSET_LIMITS[KIND];
  if (!limits.mimeTypes.includes(mimeType)) {
    const formats = limits.mimeTypes.map((m) => m.split("/")[1].toUpperCase()).join(", ");
    throw new ServiceImageValidationError(`Formato no permitido. Usá ${formats}.`);
  }
  if (size > limits.maxBytes) {
    throw new ServiceImageValidationError(`El archivo supera el máximo de ${Math.round(limits.maxBytes / (1024 * 1024))} MB.`);
  }
}

// Mismo bucket que logo/hero (site-assets, público) pero con su propia
// subcarpeta por servicio — {businessId}/service/{serviceId}/{uuid}.ext —
// porque a diferencia de logo/hero (1:1 con un campo fijo de Business), acá
// puede haber tantas fotos como servicios tenga el negocio.
function buildServiceImagePath(businessId: string, serviceId: string, mimeType: string): string {
  const ext = EXTENSION_BY_MIME[mimeType] ?? "bin";
  return `${businessId}/service/${serviceId}/${crypto.randomUUID()}.${ext}`;
}

// Mismo orden de operaciones que replaceSiteAsset() (modules/business/assets.ts):
// sube el archivo nuevo, recién DESPUÉS actualiza la referencia en Postgres,
// recién DESPUÉS borra el anterior. serviceId siempre revalidado contra
// businessId — nunca se sube una imagen para un servicio de otro negocio.
export async function replaceServiceImage(
  businessId: string,
  serviceId: string,
  file: { bytes: Buffer; mimeType: string; size: number }
): Promise<string> {
  validate(file.mimeType, file.size);

  const service = await prisma.service.findFirst({ where: { id: serviceId, businessId } });
  if (!service) throw new ServiceImageValidationError("Servicio no encontrado.");

  const admin = getSupabaseAdmin();
  const path = buildServiceImagePath(businessId, serviceId, file.mimeType);
  const { error: uploadError } = await admin.storage.from(SITE_ASSETS_BUCKET).upload(path, file.bytes, {
    contentType: file.mimeType,
    upsert: false,
  });
  if (uploadError) throw new Error(`No pudimos subir la imagen: ${uploadError.message}`);

  const url = getPublicAssetUrl(path);
  await prisma.service.update({ where: { id: serviceId }, data: { imageUrl: url } });

  const previousPath = extractAssetPath(service.imageUrl);
  if (previousPath) {
    const { error } = await admin.storage.from(SITE_ASSETS_BUCKET).remove([previousPath]);
    if (error) {
      console.error(
        `[service-images] No pudimos borrar la imagen anterior (service ${serviceId}, path ${previousPath}) — queda huérfana para el barrido periódico.`,
        error
      );
    }
  }

  return url;
}

export async function removeServiceImage(businessId: string, serviceId: string): Promise<void> {
  const service = await prisma.service.findFirst({ where: { id: serviceId, businessId } });
  if (!service?.imageUrl) return;

  await prisma.service.update({ where: { id: serviceId }, data: { imageUrl: null } });

  const previousPath = extractAssetPath(service.imageUrl);
  if (previousPath) {
    const { error } = await getSupabaseAdmin().storage.from(SITE_ASSETS_BUCKET).remove([previousPath]);
    if (error) {
      console.error(
        `[service-images] No pudimos borrar la imagen quitada (service ${serviceId}, path ${previousPath}) — queda huérfana para el barrido periódico.`,
        error
      );
    }
  }
}
