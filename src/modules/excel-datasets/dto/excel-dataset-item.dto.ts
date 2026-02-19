import { ApiProperty } from '@nestjs/swagger';
import { ExcelDataset } from '@prisma/client';
import { ExcelDatasetScopeParamDto } from './excel-dataset-scope-param.dto';

/**
 * ✅ ExcelDatasetItemDto
 *
 * DTO que representa um dataset disponível no catálogo.
 *
 * Obs.:
 * - O enum ExcelDataset vem do Prisma (schema.prisma)
 * - Portanto o example deve existir no seu Prisma (ex.: FAIR_INFO, FAIR_SUMMARY, etc.)
 */
export class ExcelDatasetItemDto {
  @ApiProperty({
    description: 'Identificador do dataset (enum).',
    enum: ExcelDataset,
    example: ExcelDataset.FAIR_SUMMARY,
  })
  dataset!: ExcelDataset;

  @ApiProperty({
    description: 'Label amigável para UI do builder.',
    example: 'Feira (Resumo)',
  })
  label!: string;

  @ApiProperty({
    description: 'Parâmetros de escopo necessários para montar o contexto.',
    type: ExcelDatasetScopeParamDto,
    isArray: true,
    example: [
      {
        key: 'fairId',
        label: 'Feira',
        type: 'UUID',
        required: true,
        hint: 'Obrigatório: exportação por feira.',
      },
    ],
  })
  scope!: ExcelDatasetScopeParamDto[];
}
