-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "benefitExpiresAt" TIMESTAMP(3),
ADD COLUMN     "previousPlanId" TEXT;

-- CreateIndex
CREATE INDEX "Subscription_benefitExpiresAt_idx" ON "Subscription"("benefitExpiresAt");
