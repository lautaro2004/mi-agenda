-- Nueva estructura comercial: Agenda interna (base) → Esencial (agenda + web)
-- → Profesional (+ WhatsApp/IA) → Empresa (Profesional para mayor volumen).

-- Nuevo gate sobre Plan (mismo patrón que galleryEnabled/digitalMenuEnabled,
-- ver 20260824160000_commercial_plan_structure): sitio público /s/[slug] y su
-- API. default true para no cortar a nadie por la sola existencia de la
-- columna — los UPDATE de abajo son los que diferencian los niveles.
ALTER TABLE "nexo"."Plan" ADD COLUMN "publicWebEnabled" BOOLEAN NOT NULL DEFAULT true;

-- "Gratis" deja de ser un plan comercial. NO se borra: hay negocios con una
-- Subscription apuntando a esa fila (Subscription.planId es FK). Se convierte
-- en el nivel base interno "Agenda interna", conservando el id
-- (plan_default_gratis) y todas las relaciones. Sin web pública, WhatsApp,
-- IA ni créditos de IA. La app lo oculta de listActivePlans() por slug
-- (BASE_PLAN_SLUG en modules/billing/subscription.ts); sigue siendo el plan
-- inicial de negocios nuevos y al que vuelve quien cancela un plan pago.
UPDATE "nexo"."Plan" SET
  "name" = 'Agenda interna',
  "slug" = 'agenda-interna',
  "description" = 'Nivel base de Nexo: agenda, servicios, horarios y turnos desde el dashboard. No incluye web pública, WhatsApp ni IA.',
  "monthlyPrice" = 0,
  "aiCredits" = 0,
  "publicWebEnabled" = false,
  "whatsappEnabled" = false,
  "depositsEnabled" = false,
  "customTrainingEnabled" = false,
  "statsEnabled" = false,
  "galleryEnabled" = false,
  "digitalMenuEnabled" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'gratis';

-- Los negocios en este nivel ya no tienen una "prueba" que vencer (no hay
-- nada de pago que probar): pasan de trialing a active sin fin de período.
UPDATE "nexo"."Subscription" SET
  "status" = 'active',
  "currentPeriodEnd" = NULL
WHERE "status" = 'trialing'
  AND "planId" IN (SELECT "id" FROM "nexo"."Plan" WHERE "slug" = 'agenda-interna');

-- Esencial: agenda + web + estadísticas básicas + galería. Sin WhatsApp/IA,
-- sin señas, sin carta+QR, sin créditos de IA. Precio y campos de Mercado Pago
-- NO se tocan (ya está en $15.000 y sincronizado).
UPDATE "nexo"."Plan" SET
  "description" = 'Tené tu negocio online y permití que tus clientes saquen turnos.',
  "aiCredits" = 0,
  "publicWebEnabled" = true,
  "whatsappEnabled" = false,
  "depositsEnabled" = false,
  "customTrainingEnabled" = false,
  "statsEnabled" = true,
  "galleryEnabled" = true,
  "digitalMenuEnabled" = false,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'esencial';

-- Profesional: todo lo de Esencial + WhatsApp/IA, señas, carta+QR. 1.000
-- créditos. Precio y Mercado Pago sin cambios.
UPDATE "nexo"."Plan" SET
  "description" = 'Sumá WhatsApp con IA: atención automática, toma de turnos, señas y carta con QR.',
  "aiCredits" = 1000,
  "publicWebEnabled" = true,
  "whatsappEnabled" = true,
  "depositsEnabled" = true,
  "customTrainingEnabled" = true,
  "statsEnabled" = true,
  "galleryEnabled" = true,
  "digitalMenuEnabled" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'profesional';

-- Empresa: mismas funcionalidades que Profesional (no se inventan otras),
-- para mayor volumen (2.500 créditos, $60.000). Se reactiva: la migración
-- 20260824160000 la había dejado en espera. mercadoPagoPlanId queda como
-- esté — si es null, el checkout devuelve PLAN_NOT_SYNCED hasta que
-- Superadmin la sincronice con Mercado Pago (guardar el plan desde
-- /superadmin/planes dispara la sincronización).
UPDATE "nexo"."Plan" SET
  "description" = 'Todo lo de Profesional, pensado para negocios con mayor volumen de atención.',
  "monthlyPrice" = 60000,
  "aiCredits" = 2500,
  "publicWebEnabled" = true,
  "whatsappEnabled" = true,
  "depositsEnabled" = true,
  "customTrainingEnabled" = true,
  "statsEnabled" = true,
  "galleryEnabled" = true,
  "digitalMenuEnabled" = true,
  "active" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'empresa';

-- Si "empresa" no existiera en algún entorno (en producción ya existe,
-- creada desde Superadmin), se crea con los valores de arriba. No pisa nada
-- si ya está.
INSERT INTO "nexo"."Plan" (
  "id", "name", "slug", "description", "monthlyPrice", "currency", "aiCredits",
  "maxServices", "publicWebEnabled", "whatsappEnabled", "depositsEnabled",
  "customTrainingEnabled", "statsEnabled", "galleryEnabled", "digitalMenuEnabled",
  "active", "createdAt", "updatedAt"
)
VALUES (
  'plan_empresa', 'Empresa', 'empresa',
  'Todo lo de Profesional, pensado para negocios con mayor volumen de atención.',
  60000, 'ARS', 2500,
  NULL, true, true, true, true, true, true, true,
  true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
