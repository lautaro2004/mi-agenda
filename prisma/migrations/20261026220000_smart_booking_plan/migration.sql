-- Agenda inteligente y chat web con IA (plan Esencial+). ADITIVA.
-- Dos permisos nuevos y opt-in sobre Plan: ningún plan existente los gana solo.
-- Profesional y Empresa los reciben UNA sola vez (al crear las columnas) porque
-- la matriz comercial los incluye; después el superadmin manda y esta
-- migración no pisa sus cambios si se vuelve a correr.
-- NO crea el plan Esencial+: se da de alta desde Superadmin (precio, créditos
-- y sincronización con Mercado Pago se administran ahí).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'nexo' AND table_name = 'Plan' AND column_name = 'smartBookingEnabled'
  ) THEN
    ALTER TABLE "nexo"."Plan" ADD COLUMN "smartBookingEnabled" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "nexo"."Plan" ADD COLUMN "webAiChatEnabled" BOOLEAN NOT NULL DEFAULT false;
    UPDATE "nexo"."Plan"
    SET "smartBookingEnabled" = true, "webAiChatEnabled" = true
    WHERE "slug" IN ('profesional', 'empresa');
  END IF;
END $$;

-- Por si solo una de las dos existía (corrida parcial).
ALTER TABLE "nexo"."Plan" ADD COLUMN IF NOT EXISTS "smartBookingEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "nexo"."Plan" ADD COLUMN IF NOT EXISTS "webAiChatEnabled" BOOLEAN NOT NULL DEFAULT false;
