-- Emails automáticos de Nexo (confirmación, recordatorio, resumen diario).
-- Aditiva: solo columnas nullable y una tabla nueva; no toca datos.

ALTER TABLE "nexo"."Appointment" ADD COLUMN "customerEmail" TEXT;
ALTER TABLE "nexo"."Appointment" ADD COLUMN "confirmationEmailSentAt" TIMESTAMP(3);
ALTER TABLE "nexo"."Appointment" ADD COLUMN "reminderEmailSentAt" TIMESTAMP(3);

CREATE TABLE "nexo"."EmailNotificationSettings" (
    "businessId" TEXT NOT NULL,
    "bookingConfirmationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderLeadMinutes" INTEGER NOT NULL DEFAULT 60,
    "dailySummaryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dailySummaryHour" INTEGER NOT NULL DEFAULT 8,
    "lastDailySummaryDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailNotificationSettings_pkey" PRIMARY KEY ("businessId")
);

ALTER TABLE "nexo"."EmailNotificationSettings"
    ADD CONSTRAINT "EmailNotificationSettings_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Convención de seguridad del proyecto (docs/security/supabase-hardening):
-- toda tabla nueva nace con RLS habilitado (deny-all). Prisma conecta como
-- postgres (BYPASSRLS), así que no cambia nada para la app.
ALTER TABLE "nexo"."EmailNotificationSettings" ENABLE ROW LEVEL SECURITY;
