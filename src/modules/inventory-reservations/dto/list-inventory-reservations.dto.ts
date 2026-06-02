import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryReservationStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

/**
 * DTO de filtros das reservas de estoque.
 * A listagem atende tanto reservas vinculadas a feira quanto finalidades avulsas.
 */
export class ListInventoryReservationsDto {
  @ApiPropertyOptional({ example: '6e7cb313-46c4-4d98-94be-3d8e480c13f5' })
  @IsOptional()
  @IsUUID()
  fairId?: string;

  @ApiPropertyOptional({ enum: InventoryReservationStatus })
  @IsOptional()
  @IsEnum(InventoryReservationStatus)
  status?: InventoryReservationStatus;

  @ApiPropertyOptional({ example: 'user_id' })
  @IsOptional()
  @IsUUID()
  requesterUserId?: string;

  @ApiPropertyOptional({ example: 'treinamento' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expectedPickupFrom?: string;

  @ApiPropertyOptional({ example: '2026-05-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expectedPickupTo?: string;

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
