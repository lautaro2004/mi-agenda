-- Analítica propia del sitio + tracking configurable. ADITIVA e idempotente:
-- tablas nuevas y una columna nullable en Inquiry. No toca datos existentes.

ALTER TABLE "nexo"."Inquiry" ADD COLUMN IF NOT EXISTS "attribution" JSONB;

CREATE TABLE IF NOT EXISTS "nexo"."SiteEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "sessionId" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "referrerHost" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SiteEvent_businessId_createdAt_idx" ON "nexo"."SiteEvent"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "SiteEvent_businessId_type_createdAt_idx" ON "nexo"."SiteEvent"("businessId", "type", "createdAt");

CREATE TABLE IF NOT EXISTS "nexo"."SiteTracking" (
    "businessId" TEXT NOT NULL,
    "gtmId" TEXT,
    "metaPixelId" TEXT,
    "ga4Id" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SiteTracking_pkey" PRIMARY KEY ("businessId")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteEvent_businessId_fkey') THEN
    ALTER TABLE "nexo"."SiteEvent" ADD CONSTRAINT "SiteEvent_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteTracking_businessId_fkey') THEN
    ALTER TABLE "nexo"."SiteTracking" ADD CONSTRAINT "SiteTracking_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
