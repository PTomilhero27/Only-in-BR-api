/*
  Warnings:

  - You are about to drop the `OwnerFairInstallment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OwnerFairPaymentPlan` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OwnerFairStallSlot` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `ownerFairId` to the `StallFair` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "AuditEntity" ADD VALUE 'STALL_FAIR';

-- DropForeignKey
ALTER TABLE "OwnerFairInstallment" DROP CONSTRAINT "OwnerFairInstallment_planId_fkey";

-- DropForeignKey
ALTER TABLE "OwnerFairPaymentPlan" DROP CONSTRAINT "OwnerFairPaymentPlan_ownerFairId_fkey";

-- DropForeignKey
ALTER TABLE "OwnerFairStallSlot" DROP CONSTRAINT "OwnerFairStallSlot_ownerFairId_fkey";

-- AlterTable
ALTER TABLE "OwnerFair" ALTER COLUMN "stallsQty" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "StallFair" ADD COLUMN     "ownerFairId" TEXT NOT NULL,
ADD COLUMN     "paidUpfrontAt" TIMESTAMP(3),
ADD COLUMN     "paidUpfrontCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unitPriceCents" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "OwnerFairInstallment";

-- DropTable
DROP TABLE "OwnerFairPaymentPlan";

-- DropTable
DROP TABLE "OwnerFairStallSlot";

-- CreateTable
CREATE TABLE "StallFairPaymentPlan" (
    "id" TEXT NOT NULL,
    "stallFairId" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "paidUpfrontCents" INTEGER NOT NULL DEFAULT 0,
    "installmentsCount" INTEGER NOT NULL,
    "status" "OwnerFairPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StallFairPaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StallFairInstallment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidAmountCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StallFairInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StallFairPaymentPlan_stallFairId_key" ON "StallFairPaymentPlan"("stallFairId");

-- CreateIndex
CREATE INDEX "StallFairPaymentPlan_status_idx" ON "StallFairPaymentPlan"("status");

-- CreateIndex
CREATE INDEX "StallFairInstallment_planId_idx" ON "StallFairInstallment"("planId");

-- CreateIndex
CREATE INDEX "StallFairInstallment_dueDate_idx" ON "StallFairInstallment"("dueDate");

-- CreateIndex
CREATE INDEX "StallFairInstallment_paidAt_idx" ON "StallFairInstallment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "StallFairInstallment_planId_number_key" ON "StallFairInstallment"("planId", "number");

-- CreateIndex
CREATE INDEX "StallFair_ownerFairId_idx" ON "StallFair"("ownerFairId");

-- AddForeignKey
ALTER TABLE "StallFair" ADD CONSTRAINT "StallFair_ownerFairId_fkey" FOREIGN KEY ("ownerFairId") REFERENCES "OwnerFair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallFairPaymentPlan" ADD CONSTRAINT "StallFairPaymentPlan_stallFairId_fkey" FOREIGN KEY ("stallFairId") REFERENCES "StallFair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallFairInstallment" ADD CONSTRAINT "StallFairInstallment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StallFairPaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
