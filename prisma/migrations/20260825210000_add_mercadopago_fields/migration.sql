-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "mercadoPagoPlanId" TEXT,
ADD COLUMN     "mercadoPagoSyncStatus" TEXT,
ADD COLUMN     "mercadoPagoLastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "mercadoPagoSyncError" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "mercadoPagoStatus" TEXT,
ADD COLUMN     "mercadoPagoLastSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Plan_mercadoPagoPlanId_key" ON "Plan"("mercadoPagoPlanId");
