import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryMovementType } from '@prisma/client';

/**
 * Resposta de movimentacao do estoque.
 * Preserva o contexto operacional para auditoria e investigacao posterior.
 */
export class InventoryMovementResponseDto {
  @ApiProperty({ example: 'b6a0d7ab-7c27-4dfc-bc92-f36d9b35e7d4' })
  id!: string;

  @ApiProperty({ example: 'item_id' })
  itemId!: string;

  @ApiPropertyOptional({ example: 'Agua 500ml' })
  itemName?: string;

  @ApiPropertyOptional({ example: 'reservation_id' })
  reservationId?: string | null;

  @ApiProperty({ enum: InventoryMovementType })
  type!: InventoryMovementType;

  @ApiProperty({ example: 10 })
  quantity!: number;

  @ApiPropertyOptional({ example: 'fair_id' })
  fairId?: string | null;

  @ApiPropertyOptional({ example: 'Reposicao manual.' })
  purpose?: string | null;

  @ApiPropertyOptional({ example: 'Reposicao manual.' })
  notes?: string | null;

  @ApiPropertyOptional({ example: 'user_id' })
  createdById?: string | null;

  @ApiPropertyOptional({ example: 'Joao da Silva' })
  responsibleName?: string | null;

  @ApiProperty({ example: false })
  requiresReturn!: boolean;

  @ApiProperty({ example: 0 })
  returnedQty!: number;

  @ApiProperty({ example: '2026-05-15T19:00:00.000Z' })
  createdAt!: string;
}
