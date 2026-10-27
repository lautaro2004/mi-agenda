-- Reglas de la agenda inteligente (una fila por negocio). ADITIVA e idempotente.
-- No toca turnos ni planes. Si el negocio pierde el plan, la fila se conserva
-- (las reglas dejan de aplicarse, no se borran).
CREATE TABLE IF NOT EXISTS "nexo"."SmartBookingRules" (
    "businessId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'assisted',
    "rules" JSONB NOT NULL DEFAULT '{}',
    "instructions" TEXT,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartBookingRules_pkey" PRIMARY KEY ("businessId")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SmartBookingRules_businessId_fkey') THEN
    ALTER TABLE "nexo"."SmartBookingRules"
      ADD CONSTRAINT "SmartBookingRules_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
