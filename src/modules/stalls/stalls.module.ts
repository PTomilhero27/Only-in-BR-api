// src/modules/public/stalls/stalls.module.ts
import { Module } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { StallsController } from './stalls.controller'
import { StallsService } from './stalls.service'

/**
 * Módulo público de Barracas.
 *
 * Observação:
 * - Registramos o StallsFormAccessService como provider compartilhado,
 *   pois as regras de janela/OwnerFair são usadas tanto no "validate" do form
 *   quanto nas ações de select/unlink do vínculo StallFair.
 */
@Module({
  controllers: [StallsController],
  providers: [PrismaService, StallsService],
  exports: [StallsService],
})
export class StallsModule {}
