-- ============================================================================
-- Rollback de 20260916000000_move_nexo_tables_to_schemas.
--
-- NO es un archivo que Prisma Migrate ejecute automáticamente (Prisma no
-- tiene "down migrations" nativas) — es el script a correr a mano si hace
-- falta revertir. Mismo tipo de operación que la migración original
-- (ALTER TABLE ... SET SCHEMA, metadata-only, instantánea, sin pérdida de
-- datos) en sentido inverso.
--
-- Después de correr esto, además:
--   1. Revertir prisma/schema.prisma a la versión sin `@@schema(...)` (o a
--      `@@schema("public")` en todos los modelos) y sin `schemas = [...]`
--      en el datasource.
--   2. `npx prisma generate` para que el cliente vuelva a asumir todo en
--      `public`.
--   3. Si se llegó a desplegar código que ya usaba el cliente nuevo, volver
--      a desplegar el build anterior (o uno regenerado con el schema
--      revertido) antes de dar por cerrado el rollback.
-- ============================================================================

BEGIN;

ALTER TABLE nexo."BusinessNotification"    SET SCHEMA public;
ALTER TABLE nexo."GalleryBlock"            SET SCHEMA public;
ALTER TABLE nexo."GalleryImage"            SET SCHEMA public;
ALTER TABLE nexo."SeoConfig"               SET SCHEMA public;
ALTER TABLE nexo."Service"                 SET SCHEMA public;
ALTER TABLE nexo."Resource"                SET SCHEMA public;
ALTER TABLE nexo."ServiceResource"         SET SCHEMA public;
ALTER TABLE nexo."Schedule"                SET SCHEMA public;
ALTER TABLE nexo."FAQ"                     SET SCHEMA public;
ALTER TABLE nexo."MemoryEntry"             SET SCHEMA public;
ALTER TABLE nexo."TrainingPlan"            SET SCHEMA public;
ALTER TABLE nexo."TrainingPlanSection"     SET SCHEMA public;
ALTER TABLE nexo."TrainingConversation"    SET SCHEMA public;
ALTER TABLE nexo."TrainingMessage"         SET SCHEMA public;
ALTER TABLE nexo."Appointment"             SET SCHEMA public;
ALTER TABLE nexo."PaymentProof"            SET SCHEMA public;
ALTER TABLE nexo."Employee"                SET SCHEMA public;
ALTER TABLE nexo."EmployeeGoal"            SET SCHEMA public;
ALTER TABLE nexo."EmployeeRestriction"     SET SCHEMA public;
ALTER TABLE nexo."EmployeeCapability"      SET SCHEMA public;
ALTER TABLE nexo."AiUsageEvent"            SET SCHEMA public;
ALTER TABLE nexo."Plan"                    SET SCHEMA public;
ALTER TABLE nexo."Subscription"            SET SCHEMA public;
ALTER TABLE nexo."MercadoPagoWebhookEvent" SET SCHEMA public;
ALTER TABLE nexo."PromoCode"               SET SCHEMA public;
ALTER TABLE nexo."PromoCodeRedemption"     SET SCHEMA public;

COMMIT;

-- Solo si nexo/crm quedaron vacíos y no se los quiere conservar:
-- DROP SCHEMA IF EXISTS nexo;
-- DROP SCHEMA IF EXISTS crm;
-- (Se deja comentado a propósito — no forma parte del rollback mínimo.)
