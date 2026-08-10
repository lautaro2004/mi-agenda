-- AlterTable
ALTER TABLE "Business" ADD COLUMN "slug" TEXT;

-- CreateTable
CREATE TABLE "SeoConfig" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "seoTitle" TEXT NOT NULL,
    "metaDescription" TEXT NOT NULL,
    "h1" TEXT NOT NULL,
    "ogTitle" TEXT NOT NULL,
    "ogDescription" TEXT NOT NULL,
    "keywords" TEXT[],
    "extraText" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SeoConfig_businessId_key" ON "SeoConfig"("businessId");

-- AddForeignKey
ALTER TABLE "SeoConfig" ADD CONSTRAINT "SeoConfig_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
