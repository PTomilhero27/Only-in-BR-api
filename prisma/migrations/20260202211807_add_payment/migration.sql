/*
  Warnings:

  - You are about to drop the column `paidUpfrontAt` on the `StallFair` table. All the data in the column will be lost.
  - You are about to drop the column `paidUpfrontCents` on the `StallFair` table. All the data in the column will be lost.
  - You are about to drop the column `unitPriceCents` on the `StallFair` table. All the data in the column will be lost.
  - You are about to drop the `StallFairInstallment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StallFairPaymentPlan` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `purchaseId` to the `StallFair` table without a default value. This is not possible if the table is not empty.
  - Added the required column `purchaseOwnerFairId` to the `StallFair` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEntity" ADD VALUE 'OWNER_FAIR_PURCHASE';
ALTER TYPE "AuditEntity" ADD VALUE 'OWNER_FAIR_PURCHASE_PAYMENT';

-- DropForeignKey
ALTER TABLE "StallFairInstallment" DROP CONSTRAINT "StallFairInstallment_planId_fkey";

-- DropForeignKey
ALTER TABLE "StallFairPaymentPlan" DROP CONSTRAINT "StallFairPaymentPlan_stallFairId_fkey";

-- AlterTable
ALTER TABLE "StallFair" DROP COLUMN "paidUpfrontAt",
DROP COLUMN "paidUpfrontCents",
DROP COLUMN "unitPriceCents",
ADD COLUMN     "purchaseId" TEXT NOT NULL,
ADD COLUMN     "purchaseOwnerFairId" TEXT NOT NULL;

-- DropTable
DROP TABLE "StallFairInstallment";

-- DropTable
DROP TABLE "StallFairPaymentPlan";

-- CreateTable
CREATE TABLE "OwnerFairPurchase" (
    "id" TEXT NOT NULL,
    "ownerFairId" TEXT NOT NULL,
    "stallSize" "StallSize" NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "paidCents" INTEGER NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "installmentsCount" INTEGER NOT NULL DEFAULT 0,
    "status" "OwnerFairPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "usedQty" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerFairPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerFairPurchaseInstallment" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidAmountCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerFairPurchaseInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnerFairPurchase_ownerFairId_idx" ON "OwnerFairPurchase"("ownerFairId");

-- CreateIndex
CREATE INDEX "OwnerFairPurchase_stallSize_idx" ON "OwnerFairPurchase"("stallSize");

-- CreateIndex
CREATE INDEX "OwnerFairPurchase_status_idx" ON "OwnerFairPurchase"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerFairPurchase_ownerFairId_stallSize_unitPriceCents_key" ON "OwnerFairPurchase"("ownerFairId", "stallSize", "unitPriceCents");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerFairPurchase_id_ownerFairId_key" ON "OwnerFairPurchase"("id", "ownerFairId");

-- CreateIndex
CREATE INDEX "OwnerFairPurchaseInstallment_purchaseId_idx" ON "OwnerFairPurchaseInstallment"("purchaseId");

-- CreateIndex
CREATE INDEX "OwnerFairPurchaseInstallment_dueDate_idx" ON "OwnerFairPurchaseInstallment"("dueDate");

-- CreateIndex
CREATE INDEX "OwnerFairPurchaseInstallment_paidAt_idx" ON "OwnerFairPurchaseInstallment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerFairPurchaseInstallment_purchaseId_number_key" ON "OwnerFairPurchaseInstallment"("purchaseId", "number");

-- CreateIndex
CREATE INDEX "StallFair_purchaseId_purchaseOwnerFairId_idx" ON "StallFair"("purchaseId", "purchaseOwnerFairId");

-- AddForeignKey
ALTER TABLE "StallFair" ADD CONSTRAINT "StallFair_purchaseId_purchaseOwnerFairId_fkey" FOREIGN KEY ("purchaseId", "purchaseOwnerFairId") REFERENCES "OwnerFairPurchase"("id", "ownerFairId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerFairPurchase" ADD CONSTRAINT "OwnerFairPurchase_ownerFairId_fkey" FOREIGN KEY ("ownerFairId") REFERENCES "OwnerFair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerFairPurchaseInstallment" ADD CONSTRAINT "OwnerFairPurchaseInstallment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "OwnerFairPurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
