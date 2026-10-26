-- Textos de la plantilla de captación (generados con IA y editables por el
-- dueño). Tabla nueva, idempotente — se puede aplicar desde el SQL Editor de
-- Supabase. Sin fila = la plantilla usa sus textos fijos de siempre.
CREATE TABLE IF NOT EXISTS "nexo"."LandingCopy" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LandingCopy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LandingCopy_businessId_key" ON "nexo"."LandingCopy"("businessId");

DO $$ BEGIN
  ALTER TABLE "nexo"."LandingCopy" ADD CONSTRAINT "LandingCopy_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
