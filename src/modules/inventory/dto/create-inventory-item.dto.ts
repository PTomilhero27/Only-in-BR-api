import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InventoryItemStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * DTO de criacao do item de estoque.
 * Define os dados cadastrais do almoxarifado e a quantidade inicial controlada pelo sistema.
 */
export class CreateInventoryItemDto {
  @ApiProperty({ example: 'Agua 500ml', description: 'Nome do item.' })
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ example: 'Bebidas', description: 'Categoria livre (texto/retrocompatibilidade).' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @ApiPropertyOptional({ example: ['uuid-cat-1'], description: 'Lista de IDs de categorias do banco.' })
  @IsOptional()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ example: 'UN', description: 'Unidade de medida exibida no estoque.' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @ApiPropertyOptional({ example: 'https://cdn.exemplo.com/agua.png', description: 'Imagem publica do item.' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'Prateleira A3', description: 'Localizacao fisica no deposito.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string;

  @ApiPropertyOptional({ example: 100, description: 'Quantidade inicial disponivel.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @ApiPropertyOptional({ example: 20, description: 'Limite usado para marcar estoque baixo.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minQuantity?: number;

  @ApiPropertyOptional({ enum: InventoryItemStatus, example: InventoryItemStatus.IN_STOCK })
  @IsOptional()
  @IsEnum(InventoryItemStatus)
  status?: InventoryItemStatus;

  @ApiPropertyOptional({ example: 'Comprar sempre antes de grandes feiras.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
