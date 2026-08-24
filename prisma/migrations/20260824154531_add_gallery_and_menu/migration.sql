-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "menuEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "menuPdfUrl" TEXT;

-- CreateTable
CREATE TABLE "GalleryBlock" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalleryBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalleryImage" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalleryImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GalleryBlock_businessId_idx" ON "GalleryBlock"("businessId");

-- CreateIndex
CREATE INDEX "GalleryBlock_businessId_active_idx" ON "GalleryBlock"("businessId", "active");

-- CreateIndex
CREATE INDEX "GalleryImage_blockId_idx" ON "GalleryImage"("blockId");

-- AddForeignKey
ALTER TABLE "GalleryBlock" ADD CONSTRAINT "GalleryBlock_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GalleryImage" ADD CONSTRAINT "GalleryImage_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "GalleryBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
