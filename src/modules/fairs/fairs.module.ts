import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { FairsController } from './fairs.controller';
import { FairsService } from './fairs.service';
import { AuditModule } from 'src/common/audit/audit.module';

/**
 * Módulo responsável pela gestão de Feiras.
 *
 * Centraliza:
 * - Criação de feiras
 * - Datas e horários (occurrences)
 * - Listagem e filtros
 *
 * Este módulo é base para futuras funcionalidades:
 * - Shows
 * - Contratos
 * - Pagamentos
 */
@Module({
  imports: [PrismaModule,  AuditModule],
  controllers: [FairsController],
  providers: [FairsService],
  exports: [FairsService],
})
export class FairsModule {}
