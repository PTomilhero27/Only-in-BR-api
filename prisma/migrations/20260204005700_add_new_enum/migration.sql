-- AlterEnum
ALTER TYPE "OwnerFairStatus" ADD VALUE 'AGUARDANDO_BARRACAS';

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "signedAt" TIMESTAMP(3);
