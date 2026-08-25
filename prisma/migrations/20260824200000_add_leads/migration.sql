-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "whatsapp" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "goals" TEXT[],
    "monthlyVolume" TEXT,
    "message" TEXT,
    "wantsMeeting" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "suggestedPlan" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contactedAt" TIMESTAMP(3),
    "meetingAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "convertedBusinessId" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_convertedBusinessId_idx" ON "Lead"("convertedBusinessId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedBusinessId_fkey" FOREIGN KEY ("convertedBusinessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
