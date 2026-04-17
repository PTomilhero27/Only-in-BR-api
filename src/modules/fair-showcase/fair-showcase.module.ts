import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { FairMapsModule } from '../fair-maps/fair-maps.module';
import { FairShowcaseController } from './fair-showcase.controller';
import { FairShowcaseService } from './fair-showcase.service';

/**
 * FairShowcaseModule
 *
 * Responsabilidade:
 * - CRUD da vitrine pública de feiras (admin).
 * - Upload de imagens (Supabase Storage).
 * - Endpoints públicos são servidos via PublicMarketplaceModule
 *   que consome o FairShowcaseService.
 *
 * Decisão:
 * - Exporta o service para ser injetado no PublicMarketplaceModule.
 */
@Module({
  imports: [PrismaModule, FairMapsModule],
  controllers: [FairShowcaseController],
  providers: [FairShowcaseService],
  exports: [FairShowcaseService],
})
export class FairShowcaseModule {}
