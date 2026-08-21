-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "operation" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiUsageEvent_businessId_idx" ON "AiUsageEvent"("businessId");

-- CreateIndex
CREATE INDEX "AiUsageEvent_businessId_createdAt_idx" ON "AiUsageEvent"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_operation_idx" ON "AiUsageEvent"("operation");
