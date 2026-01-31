-- CreateEnum
CREATE TYPE "StallSize" AS ENUM ('SIZE_2X2', 'SIZE_3X3', 'SIZE_3X6', 'TRAILER');

-- CreateEnum
CREATE TYPE "StallType" AS ENUM ('OPEN', 'CLOSED', 'TRAILER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'EXHIBITOR');

-- CreateEnum
CREATE TYPE "FairStatus" AS ENUM ('ATIVA', 'FINALIZADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "BankAccountType" AS ENUM ('CORRENTE', 'POUPANCA', 'PAGAMENTO');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "AuditEntity" AS ENUM ('FAIR', 'USER', 'FORM', 'FAIR_FORM', 'CONTRACT', 'PAYMENT', 'OWNER_FAIR');

-- CreateEnum
CREATE TYPE "OwnerFairStatus" AS ENUM ('SELECIONADO', 'AGUARDANDO_PAGAMENTO', 'AGUARDANDO_ASSINATURA', 'CONCLUIDO');

-- CreateEnum
CREATE TYPE "DocumentTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PasswordTokenType" AS ENUM ('ACTIVATE_ACCOUNT', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "OwnerFairPaymentStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordSetAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "type" "PasswordTokenType" NOT NULL DEFAULT 'RESET_PASSWORD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fair" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "FairStatus" NOT NULL DEFAULT 'ATIVA',
    "address" TEXT NOT NULL,
    "stallsCapacity" INTEGER NOT NULL DEFAULT 0,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FairOccurrence" (
    "id" TEXT NOT NULL,
    "fairId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FairOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FairForm" (
    "id" TEXT NOT NULL,
    "fairId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FairForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Owner" (
    "id" TEXT NOT NULL,
    "personType" "PersonType" NOT NULL,
    "document" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "addressFull" TEXT,
    "addressCity" TEXT,
    "addressState" TEXT,
    "addressZipcode" TEXT,
    "addressNumber" TEXT,
    "pixKey" TEXT,
    "bankName" TEXT,
    "bankAgency" TEXT,
    "bankAccount" TEXT,
    "bankAccountType" "BankAccountType",
    "bankHolderDoc" TEXT,
    "bankHolderName" TEXT,
    "stallsDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Owner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerFair" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fairId" TEXT NOT NULL,
    "stallsQty" INTEGER NOT NULL,
    "status" "OwnerFairStatus" NOT NULL DEFAULT 'SELECIONADO',
    "contractSignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerFair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerFairStallSlot" (
    "id" TEXT NOT NULL,
    "ownerFairId" TEXT NOT NULL,
    "stallSize" "StallSize" NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerFairStallSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerFairPaymentPlan" (
    "id" TEXT NOT NULL,
    "ownerFairId" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "installmentsCount" INTEGER NOT NULL,
    "status" "OwnerFairPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerFairPaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerFairInstallment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paidAmountCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerFairInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stall" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "pdvName" TEXT NOT NULL,
    "pdvNameNormalized" TEXT NOT NULL,
    "machinesQty" INTEGER NOT NULL DEFAULT 0,
    "bannerName" TEXT,
    "mainCategory" TEXT,
    "stallType" "StallType" NOT NULL DEFAULT 'OPEN',
    "stallSize" "StallSize" NOT NULL DEFAULT 'SIZE_3X3',
    "teamQty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StallFair" (
    "id" TEXT NOT NULL,
    "stallId" TEXT NOT NULL,
    "fairId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StallFair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StallMenuCategory" (
    "id" TEXT NOT NULL,
    "stallId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StallMenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StallMenuProduct" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "StallMenuProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StallEquipment" (
    "id" TEXT NOT NULL,
    "stallId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "StallEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StallPowerNeed" (
    "id" TEXT NOT NULL,
    "stallId" TEXT NOT NULL,
    "outlets110" INTEGER NOT NULL DEFAULT 0,
    "outlets220" INTEGER NOT NULL DEFAULT 0,
    "outletsOther" INTEGER NOT NULL DEFAULT 0,
    "needsGas" BOOLEAN NOT NULL DEFAULT false,
    "gasNotes" TEXT,
    "notes" TEXT,

    CONSTRAINT "StallPowerNeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entity" "AuditEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isAddendum" BOOLEAN NOT NULL DEFAULT false,
    "hasRegistration" BOOLEAN NOT NULL DEFAULT true,
    "status" "DocumentTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FairContractSettings" (
    "id" TEXT NOT NULL,
    "fairId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FairContractSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "ownerFairId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "addendumTemplateId" TEXT,
    "pdfPath" TEXT,
    "dataSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerFairAddendum" (
    "id" TEXT NOT NULL,
    "ownerFairId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersionNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnerFairAddendum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_ownerId_idx" ON "User"("ownerId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_type_idx" ON "PasswordResetToken"("type");

-- CreateIndex
CREATE INDEX "Fair_createdByUserId_idx" ON "Fair"("createdByUserId");

-- CreateIndex
CREATE INDEX "FairOccurrence_fairId_startsAt_idx" ON "FairOccurrence"("fairId", "startsAt");

-- CreateIndex
CREATE INDEX "FairOccurrence_startsAt_endsAt_idx" ON "FairOccurrence"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "FairOccurrence_fairId_startsAt_endsAt_key" ON "FairOccurrence"("fairId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Form_slug_key" ON "Form"("slug");

-- CreateIndex
CREATE INDEX "FairForm_fairId_idx" ON "FairForm"("fairId");

-- CreateIndex
CREATE INDEX "FairForm_formId_idx" ON "FairForm"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "FairForm_fairId_formId_key" ON "FairForm"("fairId", "formId");

-- CreateIndex
CREATE UNIQUE INDEX "Owner_document_key" ON "Owner"("document");

-- CreateIndex
CREATE INDEX "Owner_personType_idx" ON "Owner"("personType");

-- CreateIndex
CREATE INDEX "OwnerFair_ownerId_idx" ON "OwnerFair"("ownerId");

-- CreateIndex
CREATE INDEX "OwnerFair_fairId_idx" ON "OwnerFair"("fairId");

-- CreateIndex
CREATE INDEX "OwnerFair_status_idx" ON "OwnerFair"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerFair_ownerId_fairId_key" ON "OwnerFair"("ownerId", "fairId");

-- CreateIndex
CREATE INDEX "OwnerFairStallSlot_ownerFairId_idx" ON "OwnerFairStallSlot"("ownerFairId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerFairStallSlot_ownerFairId_stallSize_key" ON "OwnerFairStallSlot"("ownerFairId", "stallSize");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerFairPaymentPlan_ownerFairId_key" ON "OwnerFairPaymentPlan"("ownerFairId");

-- CreateIndex
CREATE INDEX "OwnerFairInstallment_planId_idx" ON "OwnerFairInstallment"("planId");

-- CreateIndex
CREATE INDEX "OwnerFairInstallment_dueDate_idx" ON "OwnerFairInstallment"("dueDate");

-- CreateIndex
CREATE INDEX "OwnerFairInstallment_paidAt_idx" ON "OwnerFairInstallment"("paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerFairInstallment_planId_number_key" ON "OwnerFairInstallment"("planId", "number");

-- CreateIndex
CREATE INDEX "Stall_ownerId_idx" ON "Stall"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Stall_ownerId_pdvNameNormalized_key" ON "Stall"("ownerId", "pdvNameNormalized");

-- CreateIndex
CREATE INDEX "StallFair_fairId_idx" ON "StallFair"("fairId");

-- CreateIndex
CREATE INDEX "StallFair_stallId_idx" ON "StallFair"("stallId");

-- CreateIndex
CREATE UNIQUE INDEX "StallFair_stallId_fairId_key" ON "StallFair"("stallId", "fairId");

-- CreateIndex
CREATE INDEX "StallMenuCategory_stallId_idx" ON "StallMenuCategory"("stallId");

-- CreateIndex
CREATE INDEX "StallMenuProduct_categoryId_idx" ON "StallMenuProduct"("categoryId");

-- CreateIndex
CREATE INDEX "StallEquipment_stallId_idx" ON "StallEquipment"("stallId");

-- CreateIndex
CREATE UNIQUE INDEX "StallPowerNeed_stallId_key" ON "StallPowerNeed"("stallId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "DocumentTemplate_status_idx" ON "DocumentTemplate"("status");

-- CreateIndex
CREATE INDEX "DocumentTemplate_isAddendum_idx" ON "DocumentTemplate"("isAddendum");

-- CreateIndex
CREATE UNIQUE INDEX "FairContractSettings_fairId_key" ON "FairContractSettings"("fairId");

-- CreateIndex
CREATE INDEX "FairContractSettings_templateId_idx" ON "FairContractSettings"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_ownerFairId_key" ON "Contract"("ownerFairId");

-- CreateIndex
CREATE INDEX "Contract_templateId_idx" ON "Contract"("templateId");

-- CreateIndex
CREATE INDEX "Contract_addendumTemplateId_idx" ON "Contract"("addendumTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnerFairAddendum_ownerFairId_key" ON "OwnerFairAddendum"("ownerFairId");

-- CreateIndex
CREATE INDEX "OwnerFairAddendum_templateId_idx" ON "OwnerFairAddendum"("templateId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fair" ADD CONSTRAINT "Fair_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairOccurrence" ADD CONSTRAINT "FairOccurrence_fairId_fkey" FOREIGN KEY ("fairId") REFERENCES "Fair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairForm" ADD CONSTRAINT "FairForm_fairId_fkey" FOREIGN KEY ("fairId") REFERENCES "Fair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairForm" ADD CONSTRAINT "FairForm_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerFair" ADD CONSTRAINT "OwnerFair_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerFair" ADD CONSTRAINT "OwnerFair_fairId_fkey" FOREIGN KEY ("fairId") REFERENCES "Fair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerFairStallSlot" ADD CONSTRAINT "OwnerFairStallSlot_ownerFairId_fkey" FOREIGN KEY ("ownerFairId") REFERENCES "OwnerFair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerFairPaymentPlan" ADD CONSTRAINT "OwnerFairPaymentPlan_ownerFairId_fkey" FOREIGN KEY ("ownerFairId") REFERENCES "OwnerFair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerFairInstallment" ADD CONSTRAINT "OwnerFairInstallment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "OwnerFairPaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stall" ADD CONSTRAINT "Stall_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Owner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallFair" ADD CONSTRAINT "StallFair_stallId_fkey" FOREIGN KEY ("stallId") REFERENCES "Stall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallFair" ADD CONSTRAINT "StallFair_fairId_fkey" FOREIGN KEY ("fairId") REFERENCES "Fair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallMenuCategory" ADD CONSTRAINT "StallMenuCategory_stallId_fkey" FOREIGN KEY ("stallId") REFERENCES "Stall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallMenuProduct" ADD CONSTRAINT "StallMenuProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "StallMenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallEquipment" ADD CONSTRAINT "StallEquipment_stallId_fkey" FOREIGN KEY ("stallId") REFERENCES "Stall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StallPowerNeed" ADD CONSTRAINT "StallPowerNeed_stallId_fkey" FOREIGN KEY ("stallId") REFERENCES "Stall"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairContractSettings" ADD CONSTRAINT "FairContractSettings_fairId_fkey" FOREIGN KEY ("fairId") REFERENCES "Fair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairContractSettings" ADD CONSTRAINT "FairContractSettings_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FairContractSettings" ADD CONSTRAINT "FairContractSettings_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_ownerFairId_fkey" FOREIGN KEY ("ownerFairId") REFERENCES "OwnerFair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_addendumTemplateId_fkey" FOREIGN KEY ("addendumTemplateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerFairAddendum" ADD CONSTRAINT "OwnerFairAddendum_ownerFairId_fkey" FOREIGN KEY ("ownerFairId") REFERENCES "OwnerFair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OwnerFairAddendum" ADD CONSTRAINT "OwnerFairAddendum_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
