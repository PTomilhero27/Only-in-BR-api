// src/modules/contracts/contracts.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { DocumentTemplatesController } from './controllers/document-templates.controller';
import { DocumentTemplatesService } from './services/document-templates.service';

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
  controllers: [DocumentTemplatesController],
  providers: [DocumentTemplatesService],
  exports: [DocumentTemplatesService],
})
export class ContractsModule {}
