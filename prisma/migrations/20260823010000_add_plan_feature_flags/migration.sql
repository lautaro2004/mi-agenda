-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "maxServices" INTEGER,
ADD COLUMN     "whatsappEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "depositsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "customTrainingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "statsEnabled" BOOLEAN NOT NULL DEFAULT true;
