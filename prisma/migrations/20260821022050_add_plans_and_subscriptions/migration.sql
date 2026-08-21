-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "aiCredits" INTEGER NOT NULL DEFAULT 40,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'trialing',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "provider" TEXT,
    "providerSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_slug_key" ON "Plan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_businessId_key" ON "Subscription"("businessId");

-- CreateIndex
CREATE INDEX "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: los negocios creados antes de este sistema no deben quedar sin
-- límites de IA (ver auditoría de la tarea, sección 3 "plan por
-- defecto/negocios existentes"). Estrategia:
--   1. Crear un plan "gratis" por defecto si todavía no existe — idempotente
--      vía ON CONFLICT en el slug único (slug es la clave real de
--      idempotencia; el id fijo es solo para que este insert sea legible).
--   2. Asignar ese plan a TODO negocio que todavía no tenga Subscription,
--      como "active" con período abierto (currentPeriodEnd NULL) — nunca
--      "trialing", para no ponerle a un negocio ya en uso una fecha de
--      vencimiento sorpresiva de un día para el otro. El trial con
--      vencimiento real (14 días) es solo para negocios NUEVOS a partir de
--      acá — ver ensureTrialSubscription() en modules/billing/subscription.ts.
-- Ambos pasos son seguros de re-ejecutar: el plan usa ON CONFLICT DO
-- NOTHING, y el insert de Subscription solo toca negocios sin fila todavía
-- (NOT EXISTS) — correr esta migración dos veces no duplica ni pisa nada.

INSERT INTO "Plan" ("id", "name", "slug", "description", "monthlyPrice", "currency", "aiCredits", "active", "createdAt", "updatedAt")
VALUES (
  'plan_default_gratis',
  'Gratis',
  'gratis',
  'Plan por defecto para negocios existentes y prueba gratuita de negocios nuevos.',
  0,
  'ARS',
  40,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "Subscription" ("id", "businessId", "planId", "status", "currentPeriodStart", "currentPeriodEnd", "provider", "createdAt", "updatedAt")
SELECT
  'sub_' || b."id",
  b."id",
  (SELECT "id" FROM "Plan" WHERE "slug" = 'gratis'),
  'active',
  CURRENT_TIMESTAMP,
  NULL,
  'manual',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Business" b
WHERE NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."businessId" = b."id");
