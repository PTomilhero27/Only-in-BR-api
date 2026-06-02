import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

/**
 * Item enviado para checagem de disponibilidade.
 * O backend calcula estoque atual, reservas bloqueantes e saldo disponivel.
 */
export class CheckInventoryAvailabilityItemDto {
  @ApiProperty({ example: 'b6a0d7ab-7c27-4dfc-bc92-f36d9b35e7d4' })
  @IsUUID()
  itemId!: string;

  @ApiProperty({ example: 40 })
  @IsInt()
  @Min(1)
  qty!: number;
}

/**
 * Payload da checagem em lote.
 * Usado antes de reservar e tambem pelo frontend para simulacoes.
 */
export class CheckInventoryAvailabilityDto {
  @ApiProperty({ type: [CheckInventoryAvailabilityItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckInventoryAvailabilityItemDto)
  items!: CheckInventoryAvailabilityItemDto[];
}

/**
 * Resultado por item da disponibilidade.
 */
export class InventoryAvailabilityItemResponseDto {
  @ApiProperty({ example: 'b6a0d7ab-7c27-4dfc-bc92-f36d9b35e7d4' })
  itemId!: string;

  @ApiProperty({ example: 'Agua 500ml' })
  name!: string;

  @ApiProperty({ example: 40 })
  requestedQty!: number;

  @ApiProperty({ example: 100 })
  currentQty!: number;

  @ApiProperty({ example: 30 })
  reservedQty!: number;

  @ApiProperty({ example: 70 })
  availableQty!: number;

  @ApiProperty({ example: true })
  isAvailable!: boolean;
}

/**
 * Resposta da checagem em lote.
 */
export class InventoryAvailabilityResponseDto {
  @ApiProperty({ type: [InventoryAvailabilityItemResponseDto] })
  items!: InventoryAvailabilityItemResponseDto[];
}
