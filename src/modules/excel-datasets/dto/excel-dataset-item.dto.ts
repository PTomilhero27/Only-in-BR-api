import { ApiProperty } from '@nestjs/swagger';
import { ExcelDataset } from '@prisma/client';

/**
 * DTO que representa um dataset disponível no catálogo.
 * Ex.: FAIR, FAIR_EXHIBITORS, FAIR_STALLS.
 */
export class ExcelDatasetItemDto {
  @ApiProperty({
    description: 'Identificador do dataset (enum).',
    enum: ExcelDataset,
    example: ExcelDataset.FAIR,
  })
  dataset!: ExcelDataset;

  @ApiProperty({
    description: 'Label amigável para UI do builder.',
    example: 'Feira',
  })
  label!: string;
}
