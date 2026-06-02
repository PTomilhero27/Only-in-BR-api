import { Module } from '@nestjs/common';
import { AuditModule } from 'src/common/audit/audit.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { InventoryReservationsController } from './inventory-reservations.controller';
import { InventoryReservationsService } from './inventory-reservations.service';

/**
 * Modulo das reservas de estoque.
 * Importa InventoryModule para reutilizar disponibilidade e movimentacao de quantidade de forma centralizada.
 */
@Module({
  imports: [PrismaModule, AuditModule, InventoryModule],
  controllers: [InventoryReservationsController],
  providers: [InventoryReservationsService],
})
export class InventoryReservationsModule {}
