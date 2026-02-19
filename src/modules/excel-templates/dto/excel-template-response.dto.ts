import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ExcelCellType,
  ExcelDataset,
  ExcelTemplateStatus,
  ExcelValueFormat,
} from '@prisma/client';

/**
 * DTO completo de retorno do template, incluindo sheets/cells/tables/columns.
 */
export class ExcelTemplateResponseDto {
  @ApiProperty({ example: '9a2b1b1a-8f12-4b33-9a7f-3d1e9c1a2b3c' })
  id!: string;

  @ApiProperty({ example: 'Relatório da Feira (Admin)' })
  name!: string;

  @ApiProperty({
    enum: ExcelTemplateStatus,
    example: ExcelTemplateStatus.ACTIVE,
  })
  status!: ExcelTemplateStatus;

  @ApiProperty({ type: () => ExcelTemplateSheetResponseDto, isArray: true })
  sheets!: ExcelTemplateSheetResponseDto[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class ExcelTemplateSheetResponseDto {
  @ApiProperty({ example: 'c16d4bfe-4c4f-4bd2-9df1-0e552b7b8e5f' })
  id!: string;

  @ApiProperty({ example: 'Relatório' })
  name!: string;

  @ApiProperty({ example: 0 })
  order!: number;

  @ApiProperty({
    enum: ExcelDataset,
    example: ExcelDataset.FAIR_SUMMARY, // ✅ existe no seu Prisma
  })
  dataset!: ExcelDataset;

  @ApiProperty({ type: () => ExcelTemplateCellResponseDto, isArray: true })
  cells!: ExcelTemplateCellResponseDto[];

  @ApiProperty({ type: () => ExcelTemplateTableResponseDto, isArray: true })
  tables!: ExcelTemplateTableResponseDto[];
}

export class ExcelTemplateCellResponseDto {
  @ApiProperty({ example: 'e1b0a3d1-9c1b-4b3a-9a2b-2c3d4e5f6a7b' })
  id!: string;

  @ApiProperty({ example: 5 })
  row!: number;

  @ApiProperty({ example: 4 })
  col!: number;

  @ApiProperty({ enum: ExcelCellType, example: ExcelCellType.TEXT })
  type!: ExcelCellType;

  @ApiProperty({ example: 'Relatório' })
  value!: string;

  @ApiPropertyOptional({
    enum: ExcelValueFormat,
    example: ExcelValueFormat.TEXT,
  })
  format?: ExcelValueFormat | null;

  @ApiProperty({ example: true })
  bold!: boolean;
}

export class ExcelTemplateTableResponseDto {
  @ApiProperty({ example: 'd91f07a8-9d9f-4f3d-a2b8-7a6e9f0c1d2e' })
  id!: string;

  @ApiProperty({ example: 10 })
  anchorRow!: number;

  @ApiProperty({ example: 4 })
  anchorCol!: number;

  @ApiProperty({
    enum: ExcelDataset,
    example: ExcelDataset.FAIR_EXHIBITORS_LIST, // ✅ existe no seu Prisma
  })
  dataset!: ExcelDataset;

  @ApiProperty({ example: true })
  includeHeader!: boolean;

  @ApiProperty({
    type: () => ExcelTemplateTableColumnResponseDto,
    isArray: true,
  })
  columns!: ExcelTemplateTableColumnResponseDto[];
}

export class ExcelTemplateTableColumnResponseDto {
  @ApiProperty({ example: '2b3c4d5e-6f70-4a1b-8c9d-0e1f2a3b4c5d' })
  id!: string;

  @ApiProperty({ example: 0 })
  order!: number;

  @ApiProperty({ example: 'Nome' })
  header!: string;

  @ApiProperty({ example: 'owner.fullName' })
  fieldKey!: string;

  @ApiPropertyOptional({
    enum: ExcelValueFormat,
    example: ExcelValueFormat.TEXT,
  })
  format?: ExcelValueFormat | null;

  @ApiPropertyOptional({ example: 28 })
  width?: number | null;
}
