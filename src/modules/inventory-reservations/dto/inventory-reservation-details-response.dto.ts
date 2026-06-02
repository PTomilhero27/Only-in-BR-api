import { ApiProperty } from '@nestjs/swagger';
import { InventoryReservationResponseDto } from './inventory-reservation-response.dto';

/**
 * Resposta detalhada da reserva.
 * Exibe itens e movimentacoes associadas para auditoria da separacao/devolucao.
 */
export class InventoryReservationDetailsResponseDto extends InventoryReservationResponseDto {
  @ApiProperty({ type: [Object] })
  items!: unknown[];

  @ApiProperty({ type: [Object] })
  movements!: unknown[];
}
