-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "assinafyDocumentId" TEXT,
ADD COLUMN     "assinafySignerId" TEXT,
ADD COLUMN     "signUrl" TEXT,
ADD COLUMN     "signUrlExpiresAt" TIMESTAMP(3);
