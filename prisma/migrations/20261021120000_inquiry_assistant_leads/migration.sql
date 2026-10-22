-- Interesados captados por el asistente de Nexo. Solo columnas nuevas y
-- opcionales (o con default) + un índice: no modifica ni borra datos.
ALTER TABLE "nexo"."Inquiry"
  ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'web',
  ADD COLUMN "need" TEXT,
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "conversationRef" TEXT,
  ADD COLUMN "nodoLeadId" TEXT,
  ADD COLUMN "nodoSyncedAt" TIMESTAMP(3),
  ADD COLUMN "nodoSyncError" TEXT;

CREATE INDEX "Inquiry_businessId_channel_conversationRef_idx" ON "nexo"."Inquiry"("businessId", "channel", "conversationRef");
