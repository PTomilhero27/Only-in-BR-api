/*
  Warnings:

  - You are about to drop the column `purchaseOwnerFairId` on the `StallFair` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "StallFair" DROP CONSTRAINT "StallFair_purchaseId_purchaseOwnerFairId_fkey";

-- DropIndex
DROP INDEX "OwnerFairPurchase_id_ownerFairId_key";

-- DropIndex
DROP INDEX "StallFair_purchaseId_purchaseOwnerFairId_idx";

-- AlterTable
ALTER TABLE "StallFair" DROP COLUMN "purchaseOwnerFairId";

-- CreateIndex
CREATE INDEX "StallFair_purchaseId_idx" ON "StallFair"("purchaseId");

-- AddForeignKey
ALTER TABLE "StallFair" ADD CONSTRAINT "StallFair_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "OwnerFairPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
