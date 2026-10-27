-- Usuarios extra de Nodo. ADITIVA e idempotente.
-- Precio por usuario extra (en la moneda del plan) para cada período, y
-- cuántos extras tiene contratados cada suscripción. NULL/0 = sin extras.
ALTER TABLE "nexo"."Plan" ADD COLUMN IF NOT EXISTS "extraUserMonthlyPrice" DOUBLE PRECISION;
ALTER TABLE "nexo"."Plan" ADD COLUMN IF NOT EXISTS "extraUserYearlyPrice" DOUBLE PRECISION;
ALTER TABLE "nexo"."Subscription" ADD COLUMN IF NOT EXISTS "extraUsers" INTEGER NOT NULL DEFAULT 0;
