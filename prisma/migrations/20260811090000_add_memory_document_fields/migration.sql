-- Permite que una MemoryEntry represente un documento subido (source =
-- "document"): el archivo original vive en Supabase Storage, acá solo la
-- referencia/metadata. Todas nullable: las entradas manuales existentes no
-- se ven afectadas.
ALTER TABLE "MemoryEntry" ADD COLUMN "filePath" TEXT;
ALTER TABLE "MemoryEntry" ADD COLUMN "fileName" TEXT;
ALTER TABLE "MemoryEntry" ADD COLUMN "mimeType" TEXT;
ALTER TABLE "MemoryEntry" ADD COLUMN "fileSizeBytes" INTEGER;
ALTER TABLE "MemoryEntry" ADD COLUMN "processingStatus" TEXT;
ALTER TABLE "MemoryEntry" ADD COLUMN "processingError" TEXT;
