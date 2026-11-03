-- Zona horaria por negocio. ADITIVA e idempotente: columna con default, no
-- cambia ningún dato existente (todos quedan en la zona de Argentina).
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "timeZone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';
