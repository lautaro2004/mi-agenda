-- CreateTable
CREATE TABLE "TrainingConversation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingConversation_businessId_idx" ON "TrainingConversation"("businessId");

-- CreateIndex
CREATE INDEX "TrainingConversation_businessId_mode_idx" ON "TrainingConversation"("businessId", "mode");

-- CreateIndex
CREATE INDEX "TrainingMessage_conversationId_idx" ON "TrainingMessage"("conversationId");

-- AddForeignKey
ALTER TABLE "TrainingConversation" ADD CONSTRAINT "TrainingConversation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingMessage" ADD CONSTRAINT "TrainingMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "TrainingConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
