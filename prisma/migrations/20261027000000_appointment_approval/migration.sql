-- Aprobación de reservas (agenda inteligente). ADITIVA e idempotente.
-- Una reserva pendiente de aprobación es status = 'pending' con esta fecha
-- cargada: retiene el horario hasta entonces y después se cancela sola.
-- Los turnos existentes quedan en NULL (sin cambios).
ALTER TABLE "nexo"."Appointment" ADD COLUMN IF NOT EXISTS "approvalExpiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Appointment_status_approvalExpiresAt_idx" ON "nexo"."Appointment" ("status", "approvalExpiresAt");
