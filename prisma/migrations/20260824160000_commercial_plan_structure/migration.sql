-- AlterTable: dos gates nuevos sobre Plan, mismo patrón que
-- whatsappEnabled/depositsEnabled/etc (ver 20260823010000_add_plan_feature_flags).
-- default true para no cortarle la galería/carta a ningún negocio existente
-- de un día para el otro — el INSERT de abajo es el que efectivamente
-- diferencia los planes comerciales.
ALTER TABLE "Plan" ADD COLUMN     "galleryEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "digitalMenuEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Nueva estructura comercial (3 planes activos + "empresa" en espera).
-- Mismo criterio que el seed original de "gratis" en
-- 20260821022050_add_plans_and_subscriptions: upsert idempotente por slug
-- (clave real de idempotencia), seguro de re-ejecutar.
--
-- depositsEnabled/statsEnabled ya estaban gateados a "Esencial" en el código
-- (ver mensajes de error existentes en app/api/business/payment-settings y
-- app/api/business/stats) antes de este pedido comercial — se respeta ese
-- corte ya implementado en vez de reinventarlo. maxServices se deja sin
-- límite (null) en los tres: el pedido comercial no menciona un tope de
-- servicios por plan, así que no se inventa uno acá.
INSERT INTO "Plan" (
  "id", "name", "slug", "description", "monthlyPrice", "currency", "aiCredits",
  "maxServices", "whatsappEnabled", "depositsEnabled", "customTrainingEnabled",
  "statsEnabled", "galleryEnabled", "digitalMenuEnabled", "active", "createdAt", "updatedAt"
)
VALUES
  (
    'plan_default_gratis', 'Gratis', 'gratis',
    'Para probar Nexo y empezar a recibir reservas reales desde tu sitio, sin pagar.',
    0, 'ARS', 40,
    NULL, false, false, false, false, false, false,
    true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'plan_esencial', 'Esencial', 'esencial',
    'Para automatizar la atención y trabajar con WhatsApp.',
    12000, 'ARS', 300,
    NULL, true, true, true, true, true, false,
    true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  ),
  (
    'plan_profesional', 'Profesional', 'profesional',
    'Para centralizar sitio, reservas, atención por WhatsApp y herramientas digitales en un solo lugar.',
    25000, 'ARS', 1000,
    NULL, true, true, true, true, true, true,
    true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  )
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "monthlyPrice" = EXCLUDED."monthlyPrice",
  "currency" = EXCLUDED."currency",
  "aiCredits" = EXCLUDED."aiCredits",
  "maxServices" = EXCLUDED."maxServices",
  "whatsappEnabled" = EXCLUDED."whatsappEnabled",
  "depositsEnabled" = EXCLUDED."depositsEnabled",
  "customTrainingEnabled" = EXCLUDED."customTrainingEnabled",
  "statsEnabled" = EXCLUDED."statsEnabled",
  "galleryEnabled" = EXCLUDED."galleryEnabled",
  "digitalMenuEnabled" = EXCLUDED."digitalMenuEnabled",
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

-- "Empresa": si ya existe (creado a mano desde Superadmin), queda
-- desactivado sin tocarle precio/créditos/features. Si no existe, este
-- UPDATE no hace nada — a propósito NO se inserta una fila nueva con
-- precio/créditos inventados, porque el pedido comercial no los especificó.
UPDATE "Plan" SET "active" = false WHERE "slug" = 'empresa';
