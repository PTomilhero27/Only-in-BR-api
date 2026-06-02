import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';

/**
 * Resultado de devolucao para um item retirado.
 * Quantidades de perda, dano e consumo viram movimentos especificos sem aumentar estoque.
 */
export class ReturnInventoryReservationItemDto {
  @ApiProperty({ example: 'b6a0d7ab-7c27-4dfc-bc92-f36d9b35e7d4' })
  @IsUUID()
  itemId!: string;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  returnedQty?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  lostQty?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  damagedQty?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsInt()
  @Min(0)
  consumedQty?: number;

  @ApiPropertyOptional({ example: 'Uma unidade voltou quebrada.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/**
 * DTO de devolucao total ou parcial.
 * Aceita divergencias acima do retirado apenas quando ha observacao explicativa.
 */
export class ReturnInventoryReservationDto {
  @ApiProperty({ type: [ReturnInventoryReservationItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnInventoryReservationItemDto)
  items!: ReturnInventoryReservationItemDto[];

  @ApiPropertyOptional({ example: 'Conferencia feita no retorno da feira.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
