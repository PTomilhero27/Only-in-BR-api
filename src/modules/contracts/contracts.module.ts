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

/**
 * Módulo de Contratos (versão inicial).
 * Responsabilidade nesta etapa:
 * - CRUD de templates de documentos (contratos e aditivos) no catálogo global.
 *
 * Observação:
 * - Em etapas futuras, este mesmo módulo também abrigará:
 *   - versionamento
 *   - geração de PDF
 *   - integração Assinafy
 *   - settings por feira e aditivo por expositor
 */
@Module({
  imports: [PrismaModule],
  controllers: [
    DocumentTemplatesController, 
    FairContractSettingsController, 
    ContractsFilesController, 
    ContractsAssinafyController,
    ContractsAssinafyWebhooksController
  ],
  providers: [
    DocumentTemplatesService, 
    ContractsStorageService, 
    ContractsAssinafyService,
    ContractsAssinafyWebhooksService
  ],
  exports: [DocumentTemplatesService],
})
export class ContractsModule {}
