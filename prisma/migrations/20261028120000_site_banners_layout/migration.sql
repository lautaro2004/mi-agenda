-- Editor modular del sitio, etapa 1: banners promocionales y orden/visibilidad
-- de secciones. ADITIVA e idempotente: dos tablas nuevas, no toca datos
-- existentes. Los sitios sin filas usan el orden de fábrica de su plantilla.
CREATE TABLE IF NOT EXISTS "nexo"."SiteBanner" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT NOT NULL DEFAULT 'text',
    "desktopImageUrl" TEXT NOT NULL,
    "mobileImageUrl" TEXT,
    "imageAlt" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "ctaType" TEXT,
    "ctaLabel" TEXT,
    "ctaValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteBanner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SiteBanner_businessId_idx" ON "nexo"."SiteBanner"("businessId");

CREATE TABLE IF NOT EXISTS "nexo"."SiteLayout" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteLayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SiteLayout_businessId_template_key" ON "nexo"."SiteLayout"("businessId", "template");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteBanner_businessId_fkey') THEN
    ALTER TABLE "nexo"."SiteBanner"
      ADD CONSTRAINT "SiteBanner_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteLayout_businessId_fkey') THEN
    ALTER TABLE "nexo"."SiteLayout"
      ADD CONSTRAINT "SiteLayout_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
