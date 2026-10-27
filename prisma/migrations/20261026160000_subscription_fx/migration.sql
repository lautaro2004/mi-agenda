-- Precios de lista en USD cobrados en ARS. ADITIVA e idempotente.
-- Mercado Pago opera en ARS: para un plan en USD se guarda el monto en pesos
-- que se está cobrando, la cotización usada y cuándo se calculó. Los planes
-- en ARS y las suscripciones existentes quedan con NULL (sin cambios).
ALTER TABLE "nexo"."Subscription" ADD COLUMN IF NOT EXISTS "arsAmount" DOUBLE PRECISION;
ALTER TABLE "nexo"."Subscription" ADD COLUMN IF NOT EXISTS "fxRate" DOUBLE PRECISION;
ALTER TABLE "nexo"."Subscription" ADD COLUMN IF NOT EXISTS "fxRateAt" TIMESTAMP(3);
