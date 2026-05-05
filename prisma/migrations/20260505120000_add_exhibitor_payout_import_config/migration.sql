-- CreateTable
CREATE TABLE "ExhibitorPayoutImportConfig" (
    "id" TEXT NOT NULL,
    "fairId" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "headerRow" INTEGER NOT NULL DEFAULT 3,
    "dataStartRow" INTEGER NOT NULL DEFAULT 4,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExhibitorPayoutImportConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExhibitorPayoutImportConfig_fairId_key" ON "ExhibitorPayoutImportConfig"("fairId");

-- AddForeignKey
ALTER TABLE "ExhibitorPayoutImportConfig" ADD CONSTRAINT "ExhibitorPayoutImportConfig_fairId_fkey" FOREIGN KEY ("fairId") REFERENCES "Fair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
