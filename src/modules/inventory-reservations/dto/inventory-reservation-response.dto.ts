import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryReservationStatus } from '@prisma/client';

/**
 * Resposta compacta da reserva.
 * Inclui totais basicos para cards/tabelas administrativas.
 */
export class InventoryReservationResponseDto {
  @ApiProperty({ example: '0f99c2d1-f2aa-4d58-b381-c76e994ca260' })
  id!: string;

  @ApiPropertyOptional({ example: '6e7cb313-46c4-4d98-94be-3d8e480c13f5' })
  fairId?: string | null;

  @ApiPropertyOptional({ example: 'Feira de maio' })
  fairName?: string | null;

  @ApiPropertyOptional({ example: 'Separacao avulsa para treinamento.' })
  purpose?: string | null;

  @ApiPropertyOptional({ example: 'user_id' })
  requesterUserId?: string | null;

  @ApiPropertyOptional({ example: 'Pedro Tomilhero' })
  requesterName?: string | null;

  @ApiPropertyOptional({ example: 'Maria Souza' })
  responsibleName?: string | null;

  @ApiProperty({ enum: InventoryReservationStatus })
  status!: InventoryReservationStatus;

  @ApiPropertyOptional({ example: '2026-05-20T14:00:00.000Z' })
  expectedPickupAt?: string | null;

  @ApiProperty({ example: 3 })
  itemsCount!: number;

  @ApiProperty({ example: 80 })
  requestedTotal!: number;

  @ApiPropertyOptional({ example: '2026-05-15T19:00:00.000Z' })
  pickedUpAt?: string | null;

  @ApiPropertyOptional({ example: '2026-05-22T19:00:00.000Z' })
  returnedAt?: string | null;

  @ApiProperty({ example: '2026-05-15T19:00:00.000Z' })
  createdAt!: string;
}
