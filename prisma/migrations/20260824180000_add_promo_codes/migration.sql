-- CreateTable
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoCodeRedemption" (
    "id" TEXT NOT NULL,
    "promoCodeId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planNameSnapshot" TEXT NOT NULL,
    "bonusExpiresAt" TIMESTAMP(3) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCodeRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "PromoCode_active_idx" ON "PromoCode"("active");

-- CreateIndex
CREATE INDEX "PromoCodeRedemption_promoCodeId_idx" ON "PromoCodeRedemption"("promoCodeId");

-- CreateIndex
CREATE INDEX "PromoCodeRedemption_businessId_idx" ON "PromoCodeRedemption"("businessId");

-- AddForeignKey
ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_promoCodeId_fkey" FOREIGN KEY ("promoCodeId") REFERENCES "PromoCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoCodeRedemption" ADD CONSTRAINT "PromoCodeRedemption_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
