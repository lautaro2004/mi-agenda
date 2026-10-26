-- Facturación unificada Nexo + Nodo — Etapa 1 (ver
-- docs/architecture/facturacion-nexo-nodo.md). ADITIVA e idempotente: no
-- borra ni cambia el significado de ninguna columna existente, no crea nada
-- en Mercado Pago y no toca suscripciones reales. Se puede pegar en el SQL
-- Editor de Supabase.

-- ── Plan: productos, usuarios de Nodo y prueba gratuita ──────────────────
-- Default ['nexo']: TODOS los planes existentes quedan exactamente como
-- estaban (planes de Nexo). Nodo o el pack se configuran desde Superadmin.
ALTER TABLE "nexo"."Plan" ADD COLUMN IF NOT EXISTS "products" TEXT[] NOT NULL DEFAULT ARRAY['nexo']::TEXT[];
-- Usuarios incluidos en Nodo (límite fijo). NULL en planes sin Nodo.
ALTER TABLE "nexo"."Plan" ADD COLUMN IF NOT EXISTS "crmMaxUsers" INTEGER;
-- Días de prueba gratuita (free_trial de Mercado Pago). NULL/0 = sin prueba.
ALTER TABLE "nexo"."Plan" ADD COLUMN IF NOT EXISTS "trialDays" INTEGER;

-- ── PlanPrice: un precio por período (mensual / anual) ───────────────────
-- Cada precio es su propio preapproval_plan en Mercado Pago (la frecuencia
-- es fija por preapproval_plan). Plan.monthlyPrice / Plan.mercadoPagoPlanId
-- quedan como columnas de compatibilidad, sincronizadas con el precio
-- mensual (no se borran).
CREATE TABLE IF NOT EXISTS "nexo"."PlanPrice" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mercadoPagoPlanId" TEXT,
    "mercadoPagoSyncStatus" TEXT,
    "mercadoPagoLastSyncedAt" TIMESTAMP(3),
    "mercadoPagoSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlanPrice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanPrice_planId_interval_key" ON "nexo"."PlanPrice"("planId", "interval");
CREATE UNIQUE INDEX IF NOT EXISTS "PlanPrice_mercadoPagoPlanId_key" ON "nexo"."PlanPrice"("mercadoPagoPlanId");
DO $$ BEGIN
  ALTER TABLE "nexo"."PlanPrice" ADD CONSTRAINT "PlanPrice_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "nexo"."Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill: cada plan pago existente obtiene su precio MENSUAL con el MISMO
-- preapproval_plan de Mercado Pago que ya tenía (no se crea nada nuevo en
-- MP; los suscriptores actuales siguen exactamente igual). Id determinístico
-- ('pp_' || planId || '_month') para que correrlo dos veces no duplique.
INSERT INTO "nexo"."PlanPrice"
  ("id", "planId", "interval", "amount", "currency", "active",
   "mercadoPagoPlanId", "mercadoPagoSyncStatus", "mercadoPagoLastSyncedAt", "mercadoPagoSyncError",
   "createdAt", "updatedAt")
SELECT 'pp_' || p."id" || '_month', p."id", 'month', p."monthlyPrice", p."currency", p."active",
       p."mercadoPagoPlanId", p."mercadoPagoSyncStatus", p."mercadoPagoLastSyncedAt", p."mercadoPagoSyncError",
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "nexo"."Plan" p
WHERE p."monthlyPrice" > 0
ON CONFLICT DO NOTHING;

-- ── Subscription: precio/período y comienzo del atraso ──────────────────
ALTER TABLE "nexo"."Subscription" ADD COLUMN IF NOT EXISTS "planPriceId" TEXT;
ALTER TABLE "nexo"."Subscription" ADD COLUMN IF NOT EXISTS "billingInterval" TEXT;
-- Inicio PERSISTIDO del atraso (primer cobro rechazado o preapproval
-- pausado). Los 7 días de gracia de Nodo se cuentan desde acá; se fija una
-- sola vez (un webhook repetido no lo reinicia) y se limpia con el próximo
-- cobro aprobado.
ALTER TABLE "nexo"."Subscription" ADD COLUMN IF NOT EXISTS "pastDueSince" TIMESTAMP(3);
DO $$ BEGIN
  ALTER TABLE "nexo"."Subscription" ADD CONSTRAINT "Subscription_planPriceId_fkey"
    FOREIGN KEY ("planPriceId") REFERENCES "nexo"."PlanPrice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "Subscription_pastDueSince_idx" ON "nexo"."Subscription"("pastDueSince");

-- Backfill: hasta hoy todo cobro por Mercado Pago era mensual.
UPDATE "nexo"."Subscription" s
SET "planPriceId" = pp."id", "billingInterval" = 'month'
FROM "nexo"."PlanPrice" pp
WHERE pp."planId" = s."planId" AND pp."interval" = 'month'
  AND s."provider" = 'mercadopago' AND s."planPriceId" IS NULL;

-- Un preapproval pausado que ya existía cuenta como atrasado desde ahora
-- (no se inventa una fecha anterior).
UPDATE "nexo"."Subscription" SET "pastDueSince" = CURRENT_TIMESTAMP
WHERE "status" = 'past_due' AND "pastDueSince" IS NULL;
