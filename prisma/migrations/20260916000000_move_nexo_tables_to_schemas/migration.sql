-- ============================================================================
-- Fase 3 — mover las tablas específicas de Nexo del schema `public` al
-- schema `nexo`, y crear el schema `crm` (vacío, reservado).
--
-- ESTADO: preparada, NO aplicada todavía. Ver
-- docs/architecture/migracion-schemas-fase3.md antes de ejecutar esto.
--
-- Es exclusivamente `CREATE SCHEMA` + `ALTER TABLE ... SET SCHEMA` — ninguna
-- sentencia reescribe datos, cambia IDs, ni recrea ninguna tabla. Postgres
-- preserva automáticamente, sin acción adicional: filas, PKs, FKs (incluidas
-- las que quedan apuntando a `public."Business"` desde `nexo.*`), índices,
-- constraints UNIQUE y valores DEFAULT. Es una operación de catálogo, no de
-- datos — prácticamente instantánea sin importar el tamaño de las tablas.
--
-- `_prisma_migrations`, `Business`, `Membership`, `Lead`, `user`, `session`,
-- `account`, `verification` NO se tocan: quedan en `public` exactamente
-- donde ya están.
-- ============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS nexo;
CREATE SCHEMA IF NOT EXISTS crm;

ALTER TABLE "BusinessNotification"    SET SCHEMA nexo;
ALTER TABLE "GalleryBlock"            SET SCHEMA nexo;
ALTER TABLE "GalleryImage"            SET SCHEMA nexo;
ALTER TABLE "SeoConfig"               SET SCHEMA nexo;
ALTER TABLE "Service"                 SET SCHEMA nexo;
ALTER TABLE "Resource"                SET SCHEMA nexo;
ALTER TABLE "ServiceResource"         SET SCHEMA nexo;
ALTER TABLE "Schedule"                SET SCHEMA nexo;
ALTER TABLE "FAQ"                     SET SCHEMA nexo;
ALTER TABLE "MemoryEntry"             SET SCHEMA nexo;
ALTER TABLE "TrainingPlan"            SET SCHEMA nexo;
ALTER TABLE "TrainingPlanSection"     SET SCHEMA nexo;
ALTER TABLE "TrainingConversation"    SET SCHEMA nexo;
ALTER TABLE "TrainingMessage"         SET SCHEMA nexo;
ALTER TABLE "Appointment"             SET SCHEMA nexo;
ALTER TABLE "PaymentProof"            SET SCHEMA nexo;
ALTER TABLE "Employee"                SET SCHEMA nexo;
ALTER TABLE "EmployeeGoal"            SET SCHEMA nexo;
ALTER TABLE "EmployeeRestriction"     SET SCHEMA nexo;
ALTER TABLE "EmployeeCapability"      SET SCHEMA nexo;
ALTER TABLE "AiUsageEvent"            SET SCHEMA nexo;
ALTER TABLE "Plan"                    SET SCHEMA nexo;
ALTER TABLE "Subscription"            SET SCHEMA nexo;
ALTER TABLE "MercadoPagoWebhookEvent" SET SCHEMA nexo;
ALTER TABLE "PromoCode"               SET SCHEMA nexo;
ALTER TABLE "PromoCodeRedemption"     SET SCHEMA nexo;

COMMIT;
