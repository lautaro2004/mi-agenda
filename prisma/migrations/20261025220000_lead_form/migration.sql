-- Formulario configurable de la plantilla de captación. Tabla nueva,
-- idempotente — se puede aplicar desde el SQL Editor de Supabase. Sin fila =
-- el formulario de siempre (DEFAULT_LEAD_FORM en lib/lead-form.ts). El sitio
-- público tolera que la tabla todavía no exista.
CREATE TABLE IF NOT EXISTS "nexo"."LeadForm" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadForm_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeadForm_businessId_key" ON "nexo"."LeadForm"("businessId");

DO $$ BEGIN
  ALTER TABLE "nexo"."LeadForm" ADD CONSTRAINT "LeadForm_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
