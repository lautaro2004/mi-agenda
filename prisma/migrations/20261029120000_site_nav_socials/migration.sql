-- Navbar configurable + redes sociales ampliadas. ADITIVA e idempotente:
-- tres columnas nullable en Business y una tabla nueva. No toca datos
-- existentes; los sitios sin fila en SiteNav usan la navegación automática.
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "tiktokUrl" TEXT;
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "youtubeUrl" TEXT;
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "linkedinUrl" TEXT;

CREATE TABLE IF NOT EXISTS "nexo"."SiteNav" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteNav_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SiteNav_businessId_key" ON "nexo"."SiteNav"("businessId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteNav_businessId_fkey') THEN
    ALTER TABLE "nexo"."SiteNav"
      ADD CONSTRAINT "SiteNav_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
