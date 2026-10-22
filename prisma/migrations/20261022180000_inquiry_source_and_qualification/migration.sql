-- Consultas desde WhatsApp + base para calificación de leads + interruptor de
-- IA de WhatsApp persistido. Aditiva e idempotente (IF NOT EXISTS) — se puede
-- aplicar también desde el SQL Editor de Supabase.
--
-- Inquiry.source: "web_form" (formulario del sitio, default → todas las
-- consultas existentes quedan así) | "whatsapp" (detectada en un chat).
ALTER TABLE "nexo"."Inquiry" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'web_form';
-- WhatsApp no trae email: pasa a ser opcional. El formulario lo sigue exigiendo
-- en la validación (inquirySchema), así que las consultas web no cambian.
ALTER TABLE "nexo"."Inquiry" ALTER COLUMN "customerEmail" DROP NOT NULL;
-- Calificación (etapa 2, todavía sin lógica que la escriba): NULL = sin
-- calificar | "qualified" | "discarded". Nodo sincroniza todo lo que NO esté
-- "discarded", así que mientras nadie califique, pasan todas.
ALTER TABLE "nexo"."Inquiry" ADD COLUMN IF NOT EXISTS "qualificationStatus" TEXT;
ALTER TABLE "nexo"."Inquiry" ADD COLUMN IF NOT EXISTS "qualificationReason" TEXT;
-- Deduplicación de leads de WhatsApp: "¿este número ya generó una consulta
-- en los últimos 30 días?".
CREATE INDEX IF NOT EXISTS "Inquiry_businessId_customerWhatsapp_idx" ON "nexo"."Inquiry"("businessId", "customerWhatsapp");

-- Interruptor global de IA de WhatsApp. Antes vivía solo en memoria y volvía
-- a "prendida" en cada reinicio del servidor — inaceptable para un negocio
-- que eligió modo manual. Default true = comportamiento de siempre.
ALTER TABLE "public"."Business" ADD COLUMN IF NOT EXISTS "whatsappAiEnabled" BOOLEAN NOT NULL DEFAULT true;
