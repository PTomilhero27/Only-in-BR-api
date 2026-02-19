import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExcelValueFormat } from '@prisma/client';

/**
 * ✅ ExcelDatasetFieldDto
 *
 * Representa um campo disponível para BIND no builder de Excel.
 * - fieldKey é a chave usada no template (ex.: "fair.name", "owner.fullName")
 * - format orienta a formatação no Excel (ExcelJS)
 * - group/hint melhoram a UX do catálogo (FieldPickerDialog)
 */
export class ExcelDatasetFieldDto {
  @ApiProperty({ example: 'fair.name' })
  fieldKey: string;

  @ApiProperty({ example: 'Nome da feira' })
  label: string;

  @ApiPropertyOptional({
    enum: ExcelValueFormat,
    example: ExcelValueFormat.TEXT,
  })
  format?: ExcelValueFormat;

  @ApiPropertyOptional({ example: 'Feira' })
  group?: string;

  @ApiPropertyOptional({
    example: 'Nome principal exibido no painel e relatórios.',
  })
  hint?: string;
}
