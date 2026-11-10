-- Pedidos de ayuda (tickets de soporte) que mandan las personas desde Nodo.
-- ADITIVA e idempotente.
CREATE TABLE IF NOT EXISTS "nexo"."SupportTicket" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "userEmail" TEXT NOT NULL,
    "product" TEXT NOT NULL DEFAULT 'nodo',
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "pagePath" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SupportTicket_status_createdAt_idx" ON "nexo"."SupportTicket"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportTicket_businessId_idx" ON "nexo"."SupportTicket"("businessId");
CREATE INDEX IF NOT EXISTS "SupportTicket_userId_createdAt_idx" ON "nexo"."SupportTicket"("userId", "createdAt");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicket_businessId_fkey') THEN
    ALTER TABLE "nexo"."SupportTicket" ADD CONSTRAINT "SupportTicket_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "public"."Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
