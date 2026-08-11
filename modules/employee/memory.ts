import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  DocumentProcessingStatus,
  MemoryCategory,
  MemoryEntry,
  MemoryImportance,
  MemorySource,
} from "@/lib/types";
import type { MemoryEntryFormValues } from "@/lib/schemas";

type Db = Prisma.TransactionClient;

const IMPORTANCE_RANK: Record<MemoryImportance, number> = { high: 0, medium: 1, low: 2 };

function toClientEntry(row: {
  id: string;
  businessId: string;
  title: string;
  content: string;
  category: string;
  importance: string;
  source: string;
  active: boolean;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: number | null;
  processingStatus: string | null;
  processingError: string | null;
}): MemoryEntry {
  return {
    id: row.id,
    businessId: row.businessId,
    title: row.title,
    content: row.content,
    category: row.category as MemoryCategory,
    importance: row.importance as MemoryImportance,
    source: row.source as MemorySource,
    active: row.active,
    fileName: row.fileName,
    mimeType: row.mimeType,
    fileSizeBytes: row.fileSizeBytes,
    processingStatus: row.processingStatus as DocumentProcessingStatus | null,
    processingError: row.processingError,
  };
}

export async function listMemoryEntries(businessId: string): Promise<MemoryEntry[]> {
  const rows = await prisma.memoryEntry.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toClientEntry);
}

// Usado por buildBusinessContext(): solo entradas activas, más importantes primero.
export async function getActiveMemoryEntries(businessId: string): Promise<MemoryEntry[]> {
  const rows = await prisma.memoryEntry.findMany({
    where: { businessId, active: true },
    orderBy: { createdAt: "desc" },
  });
  return rows
    .map(toClientEntry)
    .sort((a, b) => IMPORTANCE_RANK[a.importance] - IMPORTANCE_RANK[b.importance]);
}

export async function createMemoryEntry(
  businessId: string,
  data: MemoryEntryFormValues,
  source: MemorySource = "manual",
  db: Db = prisma
): Promise<MemoryEntry> {
  const row = await db.memoryEntry.create({ data: { businessId, ...data, source } });
  return toClientEntry(row);
}

export interface DocumentMemoryInput {
  title: string;
  content: string;
  filePath: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  processingStatus: Extract<DocumentProcessingStatus, "ready" | "error">;
  processingError: string | null;
}

// Separado de createMemoryEntry() a propósito: distinta forma de entrada
// (viene de un upload, no del formulario memoryEntrySchema — que exige
// mínimo 5 caracteres de contenido, algo que no siempre aplica acá, ej. un
// documento que falló la extracción) y distintos campos (metadata de
// archivo). Guarda la misma entidad (MemoryEntry) con source: "document" —
// no es una segunda fuente de conocimiento, es la misma tabla.
export async function createDocumentMemoryEntry(
  businessId: string,
  data: DocumentMemoryInput
): Promise<MemoryEntry> {
  const row = await prisma.memoryEntry.create({
    data: {
      businessId,
      title: data.title,
      content: data.content,
      category: "Documentos",
      importance: "medium",
      active: true,
      source: "document",
      filePath: data.filePath,
      fileName: data.fileName,
      mimeType: data.mimeType,
      fileSizeBytes: data.fileSizeBytes,
      processingStatus: data.processingStatus,
      processingError: data.processingError,
    },
  });
  return toClientEntry(row);
}

export async function updateMemoryEntry(
  businessId: string,
  id: string,
  data: MemoryEntryFormValues
): Promise<MemoryEntry | null> {
  const result = await prisma.memoryEntry.updateMany({ where: { id, businessId }, data });
  if (result.count === 0) return null;
  const row = await prisma.memoryEntry.findUniqueOrThrow({ where: { id } });
  return toClientEntry(row);
}

// Único punto que expone un filePath (dato interno, nunca sale en el
// MemoryEntry del cliente) — usado para generar la signed URL de descarga
// (ver GET /api/ai-studio/memory/[id]/file-url) validando que la entrada
// pertenezca al negocio de la sesión.
export async function getMemoryEntryFilePath(businessId: string, id: string): Promise<string | null> {
  const entry = await prisma.memoryEntry.findFirst({ where: { id, businessId }, select: { filePath: true } });
  return entry?.filePath ?? null;
}

// Devuelve el filePath de lo borrado (si tenía un archivo adjunto) para que
// el caller pueda purgarlo de Storage — ver DELETE en
// app/api/ai-studio/memory/[id]/route.ts. Nunca borra el archivo acá mismo:
// separar ambos pasos es lo que permite que un fallo de Storage no bloquee
// el borrado de la entrada (el archivo, en el peor caso, queda huérfano
// para limpiar manualmente — no hay barrido automático para este bucket
// todavía, a diferencia de site-assets).
export async function deleteMemoryEntry(
  businessId: string,
  id: string
): Promise<{ deleted: boolean; filePath: string | null }> {
  const existing = await prisma.memoryEntry.findFirst({ where: { id, businessId }, select: { filePath: true } });
  if (!existing) return { deleted: false, filePath: null };

  await prisma.memoryEntry.delete({ where: { id } });
  return { deleted: true, filePath: existing.filePath };
}
