/**
 * HealthModule
 * ---------------------------------------------------------
 * Este módulo existe para expor endpoints de saúde do serviço.
 * Ele é usado por plataformas (Railway, etc.) para saber se a API
 * está "viva" após deploy e durante o runtime.
 */
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    /**
     * Importamos o PrismaModule para poder "pingar" o banco.
     * Se o banco estiver fora, retornamos status degradado.
     */
    PrismaModule,
  ],
  controllers: [HealthController],
})
export class HealthModule {}
