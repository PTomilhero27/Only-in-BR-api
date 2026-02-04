-- DropIndex
DROP INDEX "OwnerFairPurchase_ownerFairId_stallSize_unitPriceCents_key";

-- CreateTable
CREATE TABLE "OwnerFairPurchaseInstallmentPayment" (
    "id" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerFairPurchaseInstallmentPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OwnerFairPurchaseInstallmentPayment_installmentId_idx" ON "OwnerFairPurchaseInstallmentPayment"("installmentId");

-- CreateIndex
CREATE INDEX "OwnerFairPurchaseInstallmentPayment_paidAt_idx" ON "OwnerFairPurchaseInstallmentPayment"("paidAt");

-- CreateIndex
CREATE INDEX "OwnerFairPurchaseInstallmentPayment_createdByUserId_idx" ON "OwnerFairPurchaseInstallmentPayment"("createdByUserId");

-- CreateIndex
CREATE INDEX "OwnerFairPurchase_ownerFairId_stallSize_idx" ON "OwnerFairPurchase"("ownerFairId", "stallSize");

-- CreateIndex
CREATE INDEX "OwnerFairPurchase_ownerFairId_stallSize_unitPriceCents_idx" ON "OwnerFairPurchase"("ownerFairId", "stallSize", "unitPriceCents");

-- AddForeignKey
ALTER TABLE "OwnerFairPurchaseInstallmentPayment" ADD CONSTRAINT "OwnerFairPurchaseInstallmentPayment_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "OwnerFairPurchaseInstallment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerFairPurchaseInstallmentPayment" ADD CONSTRAINT "OwnerFairPurchaseInstallmentPayment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
