import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

/**
 * Quantidade efetivamente retirada por item.
 * Se omitida, o service usa a quantidade aprovada.
 */
export class PickupInventoryReservationItemDto {
  @ApiProperty({ example: 'b6a0d7ab-7c27-4dfc-bc92-f36d9b35e7d4' })
  @IsUUID()
  itemId!: string;

  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  pickedQty!: number;
}

/**
 * DTO de retirada.
 * A retirada e o momento que baixa estoque e gera movimentos OUT.
 */
export class PickupInventoryReservationDto {
  @ApiPropertyOptional({ type: [PickupInventoryReservationItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickupInventoryReservationItemDto)
  items?: PickupInventoryReservationItemDto[];

  @ApiPropertyOptional({ example: 'Retirado pelo responsavel do evento.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
