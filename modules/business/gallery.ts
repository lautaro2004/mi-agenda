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
import type { GalleryBlock, GalleryImage } from "@/lib/types";

export class GalleryValidationError extends Error {}

const EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function validateImage(mimeType: string, size: number): void {
  const limits = ASSET_LIMITS.gallery;
  if (!limits.mimeTypes.includes(mimeType)) {
    const formats = limits.mimeTypes.map((m) => m.split("/")[1].toUpperCase()).join(", ");
    throw new GalleryValidationError(`Formato no permitido. Usá ${formats}.`);
  }
  if (size > limits.maxBytes) {
    throw new GalleryValidationError(`El archivo supera el máximo de ${Math.round(limits.maxBytes / (1024 * 1024))} MB.`);
  }
}

// {businessId}/gallery/{blockId}/{uuid}.ext — igual criterio que
// modules/business/service-images.ts: no usa buildAssetPath() genérico
// (2 niveles) porque acá hace falta anidar por blockId, no solo por kind.
function buildGalleryImagePath(businessId: string, blockId: string, mimeType: string): string {
  const ext = EXTENSION_BY_MIME[mimeType] ?? "bin";
  return `${businessId}/gallery/${blockId}/${crypto.randomUUID()}.${ext}`;
}

type BlockRow = {
  id: string;
  businessId: string;
  title: string | null;
  description: string | null;
  order: number;
  active: boolean;
  images: { id: string; blockId: string; imageUrl: string; order: number }[];
};

function toClientBlock(row: BlockRow): GalleryBlock {
  return {
    id: row.id,
    businessId: row.businessId,
    title: row.title,
    description: row.description,
    order: row.order,
    active: row.active,
    images: [...row.images].sort((a, b) => a.order - b.order).map(toClientImage),
  };
}

function toClientImage(row: { id: string; blockId: string; imageUrl: string; order: number }): GalleryImage {
  return { id: row.id, blockId: row.blockId, imageUrl: row.imageUrl, order: row.order };
}

export async function listGalleryBlocks(businessId: string): Promise<GalleryBlock[]> {
  const rows = await prisma.galleryBlock.findMany({
    where: { businessId },
    include: { images: true },
    orderBy: { order: "asc" },
  });
  return rows.map(toClientBlock);
}

// Lo que consume el sitio público (ver components/public-site/gallery-section.tsx):
// solo bloques activos Y con al menos una imagen — un bloque sin fotos no
// tiene nada que mostrar, y mostrar la sección igual dejaría un espacio
// vacío (sección 1 de la tarea: "si no existen, no debe aparecer ningún
// espacio vacío").
export async function listActiveGalleryBlocks(businessId: string): Promise<GalleryBlock[]> {
  const rows = await prisma.galleryBlock.findMany({
    where: { businessId, active: true, images: { some: {} } },
    include: { images: true },
    orderBy: { order: "asc" },
  });
  return rows.map(toClientBlock);
}

export async function createGalleryBlock(
  businessId: string,
  data: { title?: string | null; description?: string | null }
): Promise<GalleryBlock> {
  const maxOrder = await prisma.galleryBlock.aggregate({ where: { businessId }, _max: { order: true } });
  const row = await prisma.galleryBlock.create({
    data: {
      businessId,
      title: data.title || null,
      description: data.description || null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
    include: { images: true },
  });
  return toClientBlock(row);
}

export async function updateGalleryBlock(
  businessId: string,
  id: string,
  data: { title?: string | null; description?: string | null; active?: boolean }
): Promise<GalleryBlock | null> {
  const result = await prisma.galleryBlock.updateMany({
    where: { id, businessId },
    data: {
      ...(data.title !== undefined ? { title: data.title || null } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.active !== undefined ? { active: data.active } : {}),
    },
  });
  if (result.count === 0) return null;
  const row = await prisma.galleryBlock.findUniqueOrThrow({ where: { id }, include: { images: true } });
  return toClientBlock(row);
}

// Reordena por swap contra el vecino inmediato (anterior/siguiente en el
// orden actual) — alcanza para una lista corta que un dueño reordena a mano
// con botones ↑/↓, sin necesitar drag-and-drop ni una librería nueva.
export async function moveGalleryBlock(
  businessId: string,
  id: string,
  direction: "up" | "down"
): Promise<GalleryBlock[] | null> {
  const blocks = await prisma.galleryBlock.findMany({ where: { businessId }, orderBy: { order: "asc" } });
  const index = blocks.findIndex((b) => b.id === id);
  if (index === -1) return null;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= blocks.length) return listGalleryBlocks(businessId);

  const current = blocks[index];
  const sibling = blocks[swapIndex];

  await prisma.$transaction([
    prisma.galleryBlock.update({ where: { id: current.id }, data: { order: sibling.order } }),
    prisma.galleryBlock.update({ where: { id: sibling.id }, data: { order: current.order } }),
  ]);

  return listGalleryBlocks(businessId);
}

export async function deleteGalleryBlock(businessId: string, id: string): Promise<boolean> {
  const block = await prisma.galleryBlock.findFirst({ where: { id, businessId }, include: { images: true } });
  if (!block) return false;

  if (block.images.length > 0) {
    const paths = block.images.map((img) => extractAssetPath(img.imageUrl)).filter((p): p is string => p != null);
    if (paths.length > 0) {
      const { error } = await getSupabaseAdmin().storage.from(SITE_ASSETS_BUCKET).remove(paths);
      if (error) {
        console.error(`[gallery] No pudimos borrar imágenes del bloque ${id} — quedan huérfanas para el barrido periódico.`, error);
      }
    }
  }

  // onDelete: Cascade en GalleryImage.blockId ya borra las filas de imagen.
  await prisma.galleryBlock.delete({ where: { id } });
  return true;
}

export async function addGalleryImage(
  businessId: string,
  blockId: string,
  file: { bytes: Buffer; mimeType: string; size: number }
): Promise<GalleryImage> {
  validateImage(file.mimeType, file.size);

  const block = await prisma.galleryBlock.findFirst({ where: { id: blockId, businessId } });
  if (!block) throw new GalleryValidationError("Bloque no encontrado.");

  await ensureBucketExists();
  const path = buildGalleryImagePath(businessId, blockId, file.mimeType);
  await uploadSiteAsset(path, file.bytes, file.mimeType);
  const imageUrl = getPublicAssetUrl(path);

  const count = await prisma.galleryImage.count({ where: { blockId } });
  const row = await prisma.galleryImage.create({ data: { blockId, imageUrl, order: count } });
  return toClientImage(row);
}

export async function removeGalleryImage(businessId: string, blockId: string, imageId: string): Promise<boolean> {
  const image = await prisma.galleryImage.findFirst({
    where: { id: imageId, blockId, block: { businessId } },
  });
  if (!image) return false;

  const path = extractAssetPath(image.imageUrl);
  if (path) {
    const { error } = await getSupabaseAdmin().storage.from(SITE_ASSETS_BUCKET).remove([path]);
    if (error) {
      console.error(`[gallery] No pudimos borrar la imagen ${imageId} — queda huérfana para el barrido periódico.`, error);
    }
  }

  await prisma.galleryImage.delete({ where: { id: imageId } });
  return true;
}
