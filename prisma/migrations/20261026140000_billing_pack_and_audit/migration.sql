-- Superadmin comercial (Nexo + Nodo + pack). ADITIVA e idempotente.
-- Depende de 20261026120000_billing_products_prices.

-- Orden de presentación en la página de precios (menor = primero).
ALTER TABLE "nexo"."Plan" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;

-- Pack: contra QUÉ planes individuales se calcula el ahorro (puede haber
-- varios planes de Nexo). Solo se usan en planes que incluyen los dos
-- productos; SET NULL si el plan referenciado se borra (el pack sigue
-- existiendo, solo deja de mostrar ahorro).
ALTER TABLE "nexo"."Plan" ADD COLUMN IF NOT EXISTS "packNexoPlanId" TEXT;
ALTER TABLE "nexo"."Plan" ADD COLUMN IF NOT EXISTS "packCrmPlanId" TEXT;
DO $$ BEGIN
  ALTER TABLE "nexo"."Plan" ADD CONSTRAINT "Plan_packNexoPlanId_fkey"
    FOREIGN KEY ("packNexoPlanId") REFERENCES "nexo"."Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "nexo"."Plan" ADD CONSTRAINT "Plan_packCrmPlanId_fkey"
    FOREIGN KEY ("packCrmPlanId") REFERENCES "nexo"."Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Auditoría de acciones del superadmin (cambios de planes/precios y
-- operaciones sobre suscripciones). Solo inserciones; nunca se edita.
CREATE TABLE IF NOT EXISTS "nexo"."AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "businessId" TEXT,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdminAuditLog_entityType_entityId_idx" ON "nexo"."AdminAuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AdminAuditLog_businessId_createdAt_idx" ON "nexo"."AdminAuditLog"("businessId", "createdAt");
