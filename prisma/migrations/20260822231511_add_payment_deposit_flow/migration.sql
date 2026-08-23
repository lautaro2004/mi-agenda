-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "depositAmount" DOUBLE PRECISION,
ADD COLUMN     "totalAmount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "depositAccountHolder" TEXT,
ADD COLUMN     "depositAlias" TEXT,
ADD COLUMN     "depositBankName" TEXT,
ADD COLUMN     "depositCbu" TEXT,
ADD COLUMN     "depositFixedAmount" DOUBLE PRECISION,
ADD COLUMN     "depositInstructions" TEXT,
ADD COLUMN     "depositPercentage" DOUBLE PRECISION,
ADD COLUMN     "depositRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "depositTaxId" TEXT,
ADD COLUMN     "depositType" TEXT;

-- CreateTable
CREATE TABLE "PaymentProof" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "storagePath" TEXT NOT NULL,
    "originalFileName" TEXT,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,

    CONSTRAINT "PaymentProof_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentProof_businessId_idx" ON "PaymentProof"("businessId");

-- CreateIndex
CREATE INDEX "PaymentProof_businessId_status_idx" ON "PaymentProof"("businessId", "status");

-- CreateIndex
CREATE INDEX "PaymentProof_appointmentId_idx" ON "PaymentProof"("appointmentId");

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProof" ADD CONSTRAINT "PaymentProof_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
