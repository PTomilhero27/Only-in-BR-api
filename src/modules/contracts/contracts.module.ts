// src/modules/contracts/contracts.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DocumentTemplatesController } from './controllers/document-templates.controller';
import { DocumentTemplatesService } from './services/document-templates.service';
import { FairContractSettingsController } from './controllers/fair-contract-settings.controller';
import { ContractsFilesController } from './controllers/contracts-files.controller';
import { ContractsStorageService } from './services/contracts-storage.service';
import { ContractsAssinafyController } from './controllers/contracts-assinafy.controller';
import { ContractsAssinafyService } from './services/contracts-assinafy.service';
import { ContractsAssinafyWebhooksService } from './services/contracts-assinafy-webhooks.service';
import { ContractsAssinafyWebhooksController } from './controllers/contracts-assinafy-webhooks.controller';
import { ContractManagementController } from './controllers/contract-management.controller';
import { ContractManagementService } from './services/contract-management.service';

/**
 * Módulo de Contratos.
 * Responsabilidade:
 * - CRUD de templates de documentos (contratos e aditivos) no catálogo global.
 * - Duplicação de templates.
 * - Gerenciamento de contratos por tipo (FAIR_DEFAULT, MULTI_FAIR, EXHIBITOR_SPECIFIC).
 * - Integração Assinafy (assinatura digital).
 * - Upload/armazenamento de PDFs.
 * - Webhook de assinatura.
 */
@Module({
  imports: [PrismaModule],
  controllers: [
    DocumentTemplatesController,
    FairContractSettingsController,
    ContractsFilesController,
    ContractsAssinafyController,
    ContractsAssinafyWebhooksController,
    ContractManagementController,
  ],
  providers: [
    DocumentTemplatesService,
    ContractsStorageService,
    ContractsAssinafyService,
    ContractsAssinafyWebhooksService,
    ContractManagementService,
  ],
  exports: [DocumentTemplatesService],
})
export class ContractsModule {}
