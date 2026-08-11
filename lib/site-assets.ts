import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { ASSET_LIMITS, type SiteAssetKind } from "@/lib/asset-limits";

export const SITE_ASSETS_BUCKET = "site-assets";

export { ASSET_LIMITS, type SiteAssetKind };

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function extensionFor(mimeType: string): string {
  return EXTENSION_BY_MIME[mimeType] ?? "bin";
}

function publicPrefix(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return base ? `${base}/storage/v1/object/public/${SITE_ASSETS_BUCKET}/` : null;
}

export function getPublicAssetUrl(path: string): string {
  const { data } = getSupabaseAdmin().storage.from(SITE_ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Deriva el path de Storage a partir de la URL pública guardada en
// Business.logoUrl/heroImageUrl. No hace falta una columna aparte para el
// path: la URL pública de un bucket público es determinística a partir de
// él, así que alcanza con "deshacer" el prefijo conocido.
export function extractAssetPath(url: string | null | undefined): string | null {
  const prefix = publicPrefix();
  if (!url || !prefix || !url.startsWith(prefix)) return null;
  return url.slice(prefix.length);
}

// Aislamiento lógico por negocio vía el prefijo del path — ver sección de
// Storage de la tarea (site-assets/{businessId}/{kind}/{uuid}.ext). Un UUID
// nuevo en cada subida evita colisiones y hace que el archivo anterior nunca
// se pise (se borra aparte, después de confirmar el nuevo — ver
// modules/business/assets.ts).
export function buildAssetPath(businessId: string, kind: SiteAssetKind, mimeType: string): string {
  return `${businessId}/${kind}/${crypto.randomUUID()}.${extensionFor(mimeType)}`;
}

export async function uploadSiteAsset(path: string, bytes: Buffer, mimeType: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .storage.from(SITE_ASSETS_BUCKET)
    .upload(path, bytes, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`No pudimos subir el archivo: ${error.message}`);
}

// Sin try/catch acá a propósito: el caller decide si un fallo de borrado es
// fatal o no (en modules/business/assets.ts nunca lo es — el archivo queda
// huérfano para el barrido periódico en vez de tirar abajo la operación
// principal).
export async function deleteSiteAsset(path: string): Promise<void> {
  const { error } = await getSupabaseAdmin().storage.from(SITE_ASSETS_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
}

export interface SiteAssetObject {
  name: string;
  createdAt: string | null;
}

export async function listSiteAssets(businessId: string, kind: SiteAssetKind): Promise<SiteAssetObject[]> {
  const { data, error } = await getSupabaseAdmin().storage.from(SITE_ASSETS_BUCKET).list(`${businessId}/${kind}`);
  if (error || !data) return [];
  return data.map((object) => ({ name: object.name, createdAt: object.created_at ?? null }));
}

let bucketReady = false;

// Idempotente y barato después de la primera vez (se cachea en memoria por
// contenedor, mismo espíritu que el singleton de lib/prisma.ts) — se llama
// antes de cada upload en vez de depender de que alguien haya corrido un
// setup manual antes.
export async function ensureBucketExists(): Promise<void> {
  if (bucketReady) return;

  const admin = getSupabaseAdmin();
  const { data } = await admin.storage.getBucket(SITE_ASSETS_BUCKET);
  if (!data) {
    const allMimeTypes = Array.from(new Set(Object.values(ASSET_LIMITS).flatMap((l) => l.mimeTypes)));
    const maxBytes = Math.max(...Object.values(ASSET_LIMITS).map((l) => l.maxBytes));
    const { error: createError } = await admin.storage.createBucket(SITE_ASSETS_BUCKET, {
      public: true,
      fileSizeLimit: maxBytes,
      allowedMimeTypes: allMimeTypes,
    });
    if (createError && !/already exists/i.test(createError.message)) {
      throw new Error(`No pudimos preparar el almacenamiento de imágenes: ${createError.message}`);
    }
  }

  bucketReady = true;
}
