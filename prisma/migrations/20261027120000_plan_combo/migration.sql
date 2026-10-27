-- Combo Nexo + Nodo con descuento. ADITIVA: una columna opcional en Plan.
-- Un Plan con comboDiscountPct es un combo automático (lo crea el checkout al
-- contratar Nexo + Nodo juntos): no tiene precio propio, se calcula como la
-- suma de los planes referenciados (packNexoPlanId / packCrmPlanId) menos este %.
-- Los planes existentes quedan en NULL: nada cambia para ellos.
ALTER TABLE "nexo"."Plan" ADD COLUMN IF NOT EXISTS "comboDiscountPct" DOUBLE PRECISION;
