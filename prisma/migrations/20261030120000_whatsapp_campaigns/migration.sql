-- Campañas de WhatsApp. ADITIVA e idempotente: dos tablas nuevas y columnas
-- nullable en Inquiry. No toca datos existentes.

CREATE TABLE IF NOT EXISTS "nexo"."WhatsappCampaign" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "channel" TEXT NOT NULL DEFAULT 'unknown',
    "prefilledMessage" TEXT NOT NULL DEFAULT '',
    "messageVariants" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adDescription" TEXT,
    "promotedService" TEXT,
    "targetAudience" TEXT,
    "problemSolved" TEXT,
    "agentKnowledge" TEXT,
    "tone" TEXT,
    "doNotPromise" TEXT,
    "goal" TEXT NOT NULL DEFAULT 'lead_capture',
    "secondaryGoal" TEXT,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "syncNodo" BOOLEAN NOT NULL DEFAULT true,
    "createOpportunity" BOOLEAN NOT NULL DEFAULT false,
    "initialLeadStatus" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WhatsappCampaign_businessId_status_idx" ON "nexo"."WhatsappCampaign"("businessId", "status");

-- Atribución conversación → campaña. Una fila por conversación (única): la
-- primera evaluación manda y no se pisa en mensajes posteriores. campaignId
-- NULL = evaluada y sin campaña (origen desconocido). Guarda un snapshot del
-- nombre para conservar el historial aunque la campaña se edite o archive.
CREATE TABLE IF NOT EXISTS "nexo"."WhatsappCampaignAttribution" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "conversationRef" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "firstMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappCampaignAttribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsappCampaignAttribution_businessId_conversationRef_key" ON "nexo"."WhatsappCampaignAttribution"("businessId", "conversationRef");
CREATE INDEX IF NOT EXISTS "WhatsappCampaignAttribution_campaignId_idx" ON "nexo"."WhatsappCampaignAttribution"("campaignId");

ALTER TABLE "nexo"."Inquiry" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;
ALTER TABLE "nexo"."Inquiry" ADD COLUMN IF NOT EXISTS "campaignName" TEXT;
ALTER TABLE "nexo"."Inquiry" ADD COLUMN IF NOT EXISTS "attributionMethod" TEXT;
ALTER TABLE "nexo"."Inquiry" ADD COLUMN IF NOT EXISTS "requestKind" TEXT;
ALTER TABLE "nexo"."Inquiry" ADD COLUMN IF NOT EXISTS "campaignData" JSONB;
CREATE INDEX IF NOT EXISTS "Inquiry_businessId_campaignId_idx" ON "nexo"."Inquiry"("businessId", "campaignId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WhatsappCampaign_businessId_fkey') THEN
    ALTER TABLE "nexo"."WhatsappCampaign"
      ADD CONSTRAINT "WhatsappCampaign_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WhatsappCampaignAttribution_businessId_fkey') THEN
    ALTER TABLE "nexo"."WhatsappCampaignAttribution"
      ADD CONSTRAINT "WhatsappCampaignAttribution_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  -- Sin cascada: las campañas se archivan, no se borran; si se borrara una,
  -- la atribución conserva el snapshot del nombre.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WhatsappCampaignAttribution_campaignId_fkey') THEN
    ALTER TABLE "nexo"."WhatsappCampaignAttribution"
      ADD CONSTRAINT "WhatsappCampaignAttribution_campaignId_fkey"
      FOREIGN KEY ("campaignId") REFERENCES "nexo"."WhatsappCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
