import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ExcelCellType, ExcelDataset, ExcelTemplateStatus, ExcelValueFormat } from '@prisma/client';

/**
 * DTO de criação de template de Excel.
 * Este DTO é o payload completo do "designer" (abas + células + tabelas).
 */
export class CreateExcelTemplateDto {
  @ApiProperty({
    description: 'Nome do template (ex.: "Relatório da Feira").',
    example: 'Relatório da Feira (Admin)',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Status do template (ACTIVE/INACTIVE).',
    enum: ExcelTemplateStatus,
    example: ExcelTemplateStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(ExcelTemplateStatus)
  status?: ExcelTemplateStatus;

  @ApiProperty({
    description: 'Abas (sheets) do template.',
    type: () => ExcelTemplateSheetInputDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExcelTemplateSheetInputDto)
  sheets!: ExcelTemplateSheetInputDto[];
}

export class ExcelTemplateSheetInputDto {
  @ApiProperty({
    description: 'Nome da aba no Excel (ex.: "Relatório").',
    example: 'Relatório',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Ordem de exibição da aba (0..n).',
    example: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiProperty({
    description: 'Dataset base/contexto da aba (para validação de BINDs).',
    enum: ExcelDataset,
    example: ExcelDataset.FAIR,
  })
  @IsEnum(ExcelDataset)
  dataset!: ExcelDataset;

  @ApiPropertyOptional({
    description: 'Células fixas (TEXT/BIND).',
    type: () => ExcelTemplateCellInputDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExcelTemplateCellInputDto)
  cells?: ExcelTemplateCellInputDto[];

  @ApiPropertyOptional({
    description: 'Tabelas dinâmicas (listas) do template.',
    type: () => ExcelTemplateTableInputDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExcelTemplateTableInputDto)
  tables?: ExcelTemplateTableInputDto[];
}

export class ExcelTemplateCellInputDto {
  @ApiProperty({ description: 'Linha (1-based).', example: 5 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  row!: number;

  @ApiProperty({ description: 'Coluna (1-based). A=1, B=2...', example: 4 })
  @IsInt()
  @Min(1)
  @Max(16_384)
  col!: number;

  @ApiProperty({ description: 'Tipo da célula.', enum: ExcelCellType, example: ExcelCellType.TEXT })
  @IsEnum(ExcelCellType)
  type!: ExcelCellType;

  @ApiProperty({
    description:
      'Valor da célula. TEXT => literal. BIND => fieldKey (ex.: "fair.name").',
    example: 'Relatório da feira',
  })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({
    description: 'Formato opcional do valor (se não informado, pode vir do catálogo).',
    enum: ExcelValueFormat,
    example: ExcelValueFormat.TEXT,
  })
  @IsOptional()
  @IsEnum(ExcelValueFormat)
  format?: ExcelValueFormat;

  @ApiPropertyOptional({ description: 'Negrito.', example: true })
  @IsOptional()
  @IsBoolean()
  bold?: boolean;
}

export class ExcelTemplateTableInputDto {
  @ApiProperty({ description: 'Linha âncora (1-based).', example: 10 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  anchorRow!: number;

  @ApiProperty({ description: 'Coluna âncora (1-based).', example: 4 })
  @IsInt()
  @Min(1)
  @Max(16_384)
  anchorCol!: number;

  @ApiProperty({
    description: 'Dataset que a tabela lista.',
    enum: ExcelDataset,
    example: ExcelDataset.FAIR_EXHIBITORS,
  })
  @IsEnum(ExcelDataset)
  dataset!: ExcelDataset;

  @ApiPropertyOptional({
    description: 'Se true, escreve header na linha âncora.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  includeHeader?: boolean;

  @ApiProperty({
    description: 'Colunas da tabela (header + fieldKey + order).',
    type: () => ExcelTemplateTableColumnInputDto,
    isArray: true,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExcelTemplateTableColumnInputDto)
  columns!: ExcelTemplateTableColumnInputDto[];
}

export class ExcelTemplateTableColumnInputDto {
  @ApiPropertyOptional({ description: 'Ordem da coluna (0..n).', example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @ApiProperty({ description: 'Texto do header.', example: 'Nome' })
  @IsString()
  @IsNotEmpty()
  header!: string;

  @ApiProperty({
    description: 'Chave do campo (fieldKey) do catálogo.',
    example: 'owner.fullName',
  })
  @IsString()
  @IsNotEmpty()
  fieldKey!: string;

  @ApiPropertyOptional({
    description: 'Formato opcional do valor da coluna.',
    enum: ExcelValueFormat,
    example: ExcelValueFormat.TEXT,
  })
  @IsOptional()
  @IsEnum(ExcelValueFormat)
  format?: ExcelValueFormat;

  @ApiPropertyOptional({
    description: 'Largura opcional da coluna (ExcelJS).',
    example: 28,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  width?: number;
}
