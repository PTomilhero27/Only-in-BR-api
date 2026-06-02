import { Module } from '@nestjs/common';
import { AuditModule } from 'src/common/audit/audit.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryImportService } from './inventory-import.service';

/**
 * Modulo de itens de estoque.
 * Exporta InventoryService para que reservas usem a mesma regra centralizada de quantidade e disponibilidade.
 */
@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryImportService],
  exports: [InventoryService],
})
export class InventoryModule {}
