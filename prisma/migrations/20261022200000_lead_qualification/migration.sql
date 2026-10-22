-- Calificación de leads con IA (etapa 2). Aditiva e idempotente — se puede
-- aplicar también desde el SQL Editor de Supabase. Depende de
-- 20261022180000_inquiry_source_and_qualification (Inquiry.qualification*).
--
-- leadQualificationEnabled: default false → ningún negocio existente cambia
-- de comportamiento (sus consultas siguen naciendo sin calificar y pasan
-- todas a Nodo).
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "leadQualificationEnabled" BOOLEAN NOT NULL DEFAULT false;
-- Descripción libre del lead ideal, escrita por el negocio. La IA califica
-- cada chat contra esto.
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "leadIdealProfile" TEXT;
