import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

/**
 * DTO para configurar a importação da planilha de estoque.
 */
export class InventoryImportConfigDto {
  @ApiPropertyOptional({
    example: 'INVENTARIO MAIO',
    description: 'Nome da aba na planilha Google Sheets.',
    default: 'INVENTARIO MAIO',
  })
  @IsOptional()
  @IsString()
  sheetName?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Linha onde se encontram os cabeçalhos das colunas (1-based).',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  headerRow?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Linha onde iniciam os dados dos produtos (1-based).',
    default: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  dataStartRow?: number;
}
