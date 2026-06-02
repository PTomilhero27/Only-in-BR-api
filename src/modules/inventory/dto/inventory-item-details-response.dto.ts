import { ApiProperty } from '@nestjs/swagger';
import { InventoryItemResponseDto } from './inventory-item-response.dto';

/**
 * Resposta detalhada do item.
 * Acrescenta disponibilidade, reservas abertas e movimentacoes recentes para a tela de detalhe.
 */
export class InventoryItemDetailsResponseDto extends InventoryItemResponseDto {
  @ApiProperty({ example: 70 })
  availableQty!: number;

  @ApiProperty({ example: 30 })
  reservedQty!: number;

  @ApiProperty({ type: [Object] })
  openReservations!: unknown[];

  @ApiProperty({ type: [Object] })
  recentMovements!: unknown[];
}
