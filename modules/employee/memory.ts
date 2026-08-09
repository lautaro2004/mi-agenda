import { prisma } from "@/lib/prisma";
import type { MemoryCategory, MemoryEntry, MemoryImportance, MemorySource } from "@/lib/types";
import type { MemoryEntryFormValues } from "@/lib/schemas";

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
  source: MemorySource = "manual"
): Promise<MemoryEntry> {
  const row = await prisma.memoryEntry.create({ data: { businessId, ...data, source } });
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

export async function deleteMemoryEntry(businessId: string, id: string): Promise<boolean> {
  const result = await prisma.memoryEntry.deleteMany({ where: { id, businessId } });
  return result.count > 0;
}
