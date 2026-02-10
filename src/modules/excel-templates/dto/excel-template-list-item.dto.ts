import { ApiProperty } from '@nestjs/swagger';
import { ExcelTemplateStatus } from '@prisma/client';

/**
 * DTO enxuto para listagem de templates.
 */
export class ExcelTemplateListItemDto {
  @ApiProperty({ example: '9a2b1b1a-8f12-4b33-9a7f-3d1e9c1a2b3c' })
  id!: string;

  @ApiProperty({ example: 'Relatório da Feira (Admin)' })
  name!: string;

  @ApiProperty({ enum: ExcelTemplateStatus, example: ExcelTemplateStatus.ACTIVE })
  status!: ExcelTemplateStatus;

  @ApiProperty({ example: '2026-02-06T12:34:56.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-02-06T12:34:56.000Z' })
  updatedAt!: Date;
}
