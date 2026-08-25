-- CreateTable
CREATE TABLE "BusinessNotification" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resourceHref" TEXT,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BusinessNotification_businessId_readAt_idx" ON "BusinessNotification"("businessId", "readAt");

-- CreateIndex
CREATE INDEX "BusinessNotification_businessId_createdAt_idx" ON "BusinessNotification"("businessId", "createdAt");

-- AddForeignKey
ALTER TABLE "BusinessNotification" ADD CONSTRAINT "BusinessNotification_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
