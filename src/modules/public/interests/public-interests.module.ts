import { Module } from '@nestjs/common';

import { PrismaModule } from '../../../prisma/prisma.module';
import { PublicInterestsController } from './public-interests.controller';
import { PublicInterestsService } from './public-interests.service';

/**
 * PublicInterestsModule
 *
 * Responsabilidade:
 * - Agrupar o fluxo público do "cadastro de interessado" (sem autenticação)
 * - Expor rotas sob /public/interests/*
 *
 * Decisão:
 * - MailModule é @Global(), então MailService já está disponível via DI.
 * - Mantemos separado do módulo "Interests" (admin) para evitar mistura de rotas.
 */
@Module({
  imports: [PrismaModule],
  controllers: [PublicInterestsController],
  providers: [PublicInterestsService],
  exports: [PublicInterestsService],
})
export class PublicInterestsModule {}
