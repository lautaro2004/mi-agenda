-- Horario de la IA de WhatsApp. ADITIVA e idempotente: columna nullable (sin
-- valor = la IA responde siempre, como hasta ahora).
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "whatsappAiSchedule" JSONB;
