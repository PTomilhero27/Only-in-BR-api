-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');

-- CreateEnum
CREATE TYPE "FairSupplierInstallmentStatus" AS ENUM ('PENDING', 'INCLUDED_IN_REMITTANCE', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FairSupplierStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PixRemittanceStatus" AS ENUM ('GENERATED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PixRemittancePayeeType" AS ENUM ('SUPPLIER', 'EXHIBITOR');

-- CreateEnum
CREATE TYPE "ExhibitorPayoutStatus" AS ENUM ('PENDING', 'INCLUDED_IN_REMITTANCE', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExhibitorPayoutSource" AS ENUM ('MANUAL', 'IMPORTED', 'CALCULATED');

-- AlterEnum
ALTER TYPE "AuditEntity" ADD VALUE 'FAIR_SUPPLIER';
ALTER TYPE "AuditEntity" ADD VALUE 'PIX_REMITTANCE';
ALTER TYPE "AuditEntity" ADD VALUE 'EXHIBITOR_PAYOUT';

-- AlterTable
ALTER TABLE "Owner" ADD COLUMN "pixKeyType" "PixKeyType";

-- CreateTable
CREATE TABLE "FairSupplier" (
  "id" TEXT NOT NULL,
  "fairId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "document" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "pixKeyType" "PixKeyType" NOT NULL,
  "pixKey" TEXT NOT NULL,
  "description" TEXT,
  "totalAmountCents" INTEGER NOT NULL DEFAULT 0,
  "paidAmountCents" INTEGER NOT NULL DEFAULT 0,
  "pendingAmountCents" INTEGER NOT NULL DEFAULT 0,
  "status" "FairSupplierStatus" NOT NULL DEFAULT 'PENDING',
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FairSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FairSupplierInstallment" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "description" TEXT,
  "dueDate" TIMESTAMP(3),
  "amountCents" INTEGER NOT NULL,
  "paidAmountCents" INTEGER NOT NULL DEFAULT 0,
  "paidAt" TIMESTAMP(3),
  "status" "FairSupplierInstallmentStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FairSupplierInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExhibitorPayout" (
  "id" TEXT NOT NULL,
  "ownerFairId" TEXT NOT NULL,
  "grossAmountCents" INTEGER NOT NULL,
  "discountAmountCents" INTEGER NOT NULL DEFAULT 0,
  "netAmountCents" INTEGER NOT NULL,
  "adjustmentAmountCents" INTEGER NOT NULL DEFAULT 0,
  "paidAmountCents" INTEGER NOT NULL DEFAULT 0,
  "dueDate" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "status" "ExhibitorPayoutStatus" NOT NULL DEFAULT 'PENDING',
  "source" "ExhibitorPayoutSource" NOT NULL DEFAULT 'MANUAL',
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExhibitorPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PixRemittance" (
  "id" TEXT NOT NULL,
  "fairId" TEXT NOT NULL,
  "paymentDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "status" "PixRemittanceStatus" NOT NULL DEFAULT 'GENERATED',
  "fileName" TEXT,
  "fileContent" TEXT,
  "totalItems" INTEGER NOT NULL DEFAULT 0,
  "totalAmountCents" INTEGER NOT NULL DEFAULT 0,
  "paidAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PixRemittance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PixRemittanceItem" (
  "id" TEXT NOT NULL,
  "pixRemittanceId" TEXT NOT NULL,
  "payeeType" "PixRemittancePayeeType" NOT NULL,
  "supplierInstallmentId" TEXT,
  "exhibitorPayoutId" TEXT,
  "amountCents" INTEGER NOT NULL,
  "payeeName" TEXT NOT NULL,
  "payeeDocument" TEXT NOT NULL,
  "pixKeyType" "PixKeyType" NOT NULL,
  "pixKey" TEXT NOT NULL,
  "txId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PixRemittanceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FairSupplier_fairId_idx" ON "FairSupplier"("fairId");
CREATE INDEX "FairSupplier_document_idx" ON "FairSupplier"("document");
CREATE INDEX "FairSupplier_status_idx" ON "FairSupplier"("status");
CREATE UNIQUE INDEX "FairSupplierInstallment_supplierId_number_key" ON "FairSupplierInstallment"("supplierId", "number");
CREATE INDEX "FairSupplierInstallment_supplierId_idx" ON "FairSupplierInstallment"("supplierId");
CREATE INDEX "FairSupplierInstallment_status_idx" ON "FairSupplierInstallment"("status");
CREATE INDEX "FairSupplierInstallment_dueDate_idx" ON "FairSupplierInstallment"("dueDate");
CREATE UNIQUE INDEX "ExhibitorPayout_ownerFairId_key" ON "ExhibitorPayout"("ownerFairId");
CREATE INDEX "ExhibitorPayout_status_idx" ON "ExhibitorPayout"("status");
CREATE INDEX "ExhibitorPayout_dueDate_idx" ON "ExhibitorPayout"("dueDate");
CREATE INDEX "PixRemittance_fairId_idx" ON "PixRemittance"("fairId");
CREATE INDEX "PixRemittance_status_idx" ON "PixRemittance"("status");
CREATE INDEX "PixRemittance_paymentDate_idx" ON "PixRemittance"("paymentDate");
CREATE UNIQUE INDEX "PixRemittanceItem_supplierInstallmentId_key" ON "PixRemittanceItem"("supplierInstallmentId");
CREATE UNIQUE INDEX "PixRemittanceItem_exhibitorPayoutId_key" ON "PixRemittanceItem"("exhibitorPayoutId");
CREATE INDEX "PixRemittanceItem_pixRemittanceId_idx" ON "PixRemittanceItem"("pixRemittanceId");
CREATE INDEX "PixRemittanceItem_payeeType_idx" ON "PixRemittanceItem"("payeeType");
CREATE INDEX "PixRemittanceItem_supplierInstallmentId_idx" ON "PixRemittanceItem"("supplierInstallmentId");
CREATE INDEX "PixRemittanceItem_exhibitorPayoutId_idx" ON "PixRemittanceItem"("exhibitorPayoutId");

-- AddForeignKey
ALTER TABLE "FairSupplier" ADD CONSTRAINT "FairSupplier_fairId_fkey" FOREIGN KEY ("fairId") REFERENCES "Fair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FairSupplier" ADD CONSTRAINT "FairSupplier_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FairSupplierInstallment" ADD CONSTRAINT "FairSupplierInstallment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "FairSupplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExhibitorPayout" ADD CONSTRAINT "ExhibitorPayout_ownerFairId_fkey" FOREIGN KEY ("ownerFairId") REFERENCES "OwnerFair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExhibitorPayout" ADD CONSTRAINT "ExhibitorPayout_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PixRemittance" ADD CONSTRAINT "PixRemittance_fairId_fkey" FOREIGN KEY ("fairId") REFERENCES "Fair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PixRemittance" ADD CONSTRAINT "PixRemittance_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PixRemittanceItem" ADD CONSTRAINT "PixRemittanceItem_pixRemittanceId_fkey" FOREIGN KEY ("pixRemittanceId") REFERENCES "PixRemittance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PixRemittanceItem" ADD CONSTRAINT "PixRemittanceItem_supplierInstallmentId_fkey" FOREIGN KEY ("supplierInstallmentId") REFERENCES "FairSupplierInstallment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PixRemittanceItem" ADD CONSTRAINT "PixRemittanceItem_exhibitorPayoutId_fkey" FOREIGN KEY ("exhibitorPayoutId") REFERENCES "ExhibitorPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
