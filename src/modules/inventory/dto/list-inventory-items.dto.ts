import { ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryItemStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * DTO de filtros da listagem de itens.
 * Centraliza paginacao e criterios simples para a tela administrativa de estoque.
 */
export class ListInventoryItemsDto {
  @ApiPropertyOptional({ example: 'agua' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'Bebidas' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: InventoryItemStatus })
  @IsOptional()
  @IsEnum(InventoryItemStatus)
  status?: InventoryItemStatus;

  @ApiPropertyOptional({ example: true, description: 'Quando true, retorna itens com quantity <= minQuantity.' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  lowStock?: boolean;

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
  @Max(10000)
  perPage?: number = 20;
}
