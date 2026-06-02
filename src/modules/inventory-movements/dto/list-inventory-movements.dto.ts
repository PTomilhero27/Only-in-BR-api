import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryMovementType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * DTO de filtros do historico de movimentacoes.
 * Mantem o historico paginado e pesquisavel por item, reserva, feira e periodo.
 */
export class ListInventoryMovementsDto {
  @ApiPropertyOptional({ example: 'b6a0d7ab-7c27-4dfc-bc92-f36d9b35e7d4' })
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @ApiPropertyOptional({ example: '0f99c2d1-f2aa-4d58-b381-c76e994ca260' })
  @IsOptional()
  @IsUUID()
  reservationId?: string;

  @ApiPropertyOptional({ example: '6e7cb313-46c4-4d98-94be-3d8e480c13f5' })
  @IsOptional()
  @IsUUID()
  fairId?: string;

  @ApiPropertyOptional({ enum: InventoryMovementType })
  @IsOptional()
  @IsEnum(InventoryMovementType)
  type?: InventoryMovementType;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2026-05-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;
}
