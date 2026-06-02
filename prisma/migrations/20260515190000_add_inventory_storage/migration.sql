-- Enums do modulo administrativo de estoque / armazenagem.
CREATE TYPE "InventoryItemStatus" AS ENUM ('IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'INACTIVE', 'DAMAGED');
CREATE TYPE "InventoryReservationStatus" AS ENUM ('PENDING', 'APPROVED', 'SEPARATING', 'READY_FOR_PICKUP', 'PICKED_UP', 'PARTIALLY_RETURNED', 'RETURNED', 'CANCELLED');
CREATE TYPE "InventoryMovementType" AS ENUM ('IN', 'OUT', 'RETURN', 'LOSS', 'ADJUSTMENT', 'DAMAGE');

ALTER TYPE "AuditEntity" ADD VALUE 'INVENTORY_ITEM';
ALTER TYPE "AuditEntity" ADD VALUE 'INVENTORY_RESERVATION';
ALTER TYPE "AuditEntity" ADD VALUE 'INVENTORY_MOVEMENT';

CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "imageUrl" TEXT,
    "location" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" "InventoryItemStatus" NOT NULL DEFAULT 'IN_STOCK',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "fairId" TEXT,
    "purpose" TEXT,
    "requesterUserId" TEXT,
    "responsibleName" TEXT,
    "status" "InventoryReservationStatus" NOT NULL DEFAULT 'PENDING',
    "expectedPickupAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryReservationItem" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "requestedQty" INTEGER NOT NULL,
    "approvedQty" INTEGER,
    "pickedQty" INTEGER,
    "returnedQty" INTEGER,
    "lostQty" INTEGER,
    "damagedQty" INTEGER,
    "consumedQty" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InventoryReservationItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "reservationId" TEXT,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "fairId" TEXT,
    "purpose" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryItem_name_idx" ON "InventoryItem"("name");
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");
CREATE INDEX "InventoryItem_status_idx" ON "InventoryItem"("status");

CREATE INDEX "InventoryReservation_fairId_idx" ON "InventoryReservation"("fairId");
CREATE INDEX "InventoryReservation_status_idx" ON "InventoryReservation"("status");
CREATE INDEX "InventoryReservation_requesterUserId_idx" ON "InventoryReservation"("requesterUserId");

CREATE UNIQUE INDEX "InventoryReservationItem_reservationId_itemId_key" ON "InventoryReservationItem"("reservationId", "itemId");
CREATE INDEX "InventoryReservationItem_itemId_idx" ON "InventoryReservationItem"("itemId");

CREATE INDEX "InventoryMovement_itemId_idx" ON "InventoryMovement"("itemId");
CREATE INDEX "InventoryMovement_reservationId_idx" ON "InventoryMovement"("reservationId");
CREATE INDEX "InventoryMovement_type_idx" ON "InventoryMovement"("type");
CREATE INDEX "InventoryMovement_fairId_idx" ON "InventoryMovement"("fairId");
CREATE INDEX "InventoryMovement_createdAt_idx" ON "InventoryMovement"("createdAt");

ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_fairId_fkey" FOREIGN KEY ("fairId") REFERENCES "Fair"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryReservationItem" ADD CONSTRAINT "InventoryReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryReservationItem" ADD CONSTRAINT "InventoryReservationItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_fairId_fkey" FOREIGN KEY ("fairId") REFERENCES "Fair"("id") ON DELETE SET NULL ON UPDATE CASCADE;
