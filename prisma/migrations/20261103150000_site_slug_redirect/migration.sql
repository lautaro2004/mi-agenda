-- Redirecciones de slugs viejos al nuevo cuando un negocio cambia su URL
-- pública. ADITIVA e idempotente.
CREATE TABLE IF NOT EXISTS "nexo"."SiteSlugRedirect" (
    "oldSlug" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteSlugRedirect_pkey" PRIMARY KEY ("oldSlug")
);
CREATE INDEX IF NOT EXISTS "SiteSlugRedirect_businessId_idx" ON "nexo"."SiteSlugRedirect"("businessId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SiteSlugRedirect_businessId_fkey') THEN
    ALTER TABLE "nexo"."SiteSlugRedirect" ADD CONSTRAINT "SiteSlugRedirect_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
