import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryItemStatus } from '@prisma/client';

/**
 * Resposta compacta do item de estoque.
 * Usada em listagens e retornos de criacao/edicao.
 */
export class InventoryItemResponseDto {
  @ApiProperty({ example: 'b6a0d7ab-7c27-4dfc-bc92-f36d9b35e7d4' })
  id!: string;

  @ApiProperty({ example: 'Agua 500ml' })
  name!: string;

  @ApiPropertyOptional({ example: 'Bebidas' })
  category?: string | null;

  @ApiPropertyOptional({ example: [{ id: 'uuid-cat', name: 'Bebidas' }] })
  categories?: Array<{ id: string; name: string }>;

  @ApiProperty({ example: 'UN' })
  unit!: string;

  @ApiPropertyOptional({ example: 'https://cdn.exemplo.com/agua.png' })
  imageUrl?: string | null;

  @ApiPropertyOptional({ example: 'Prateleira A3' })
  location?: string | null;

  @ApiProperty({ example: 100 })
  quantity!: number;

  @ApiProperty({ example: 20 })
  minQuantity!: number;

  @ApiProperty({ enum: InventoryItemStatus })
  status!: InventoryItemStatus;

  @ApiPropertyOptional({ example: 'Comprar sempre antes de grandes feiras.' })
  notes?: string | null;

  @ApiProperty({ example: '2026-05-15T19:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-05-15T19:00:00.000Z' })
  updatedAt!: string;
}
