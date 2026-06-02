import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { InventoryMovementsController } from './inventory-movements.controller';
import { InventoryMovementsService } from './inventory-movements.service';

/**
 * Modulo do historico de movimentacoes.
 * Mantem a consulta separada do CRUD de itens para organizar melhor a superficie administrativa.
 */
@Module({
  imports: [PrismaModule],
  controllers: [InventoryMovementsController],
  providers: [InventoryMovementsService],
})
export class InventoryMovementsModule {}
