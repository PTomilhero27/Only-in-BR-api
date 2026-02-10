import { ApiProperty } from '@nestjs/swagger';
import { ExcelValueFormat } from '@prisma/client';

/**
 * DTO que representa um campo disponível dentro de um dataset.
 * Esse DTO é usado pelo builder do admin para listar quais "fieldKeys"
 * podem ser usados em células (BIND) e colunas de tabela.
 */
export class ExcelDatasetFieldDto {
  @ApiProperty({
    description:
      'Chave única do campo (fieldKey) usada no template. Ex.: "fair.name", "owner.fullName".',
    example: 'fair.name',
  })
  key!: string;

  @ApiProperty({
    description: 'Label amigável para UI do builder.',
    example: 'Nome da feira',
  })
  label!: string;

  @ApiProperty({
    description:
      'Formato sugerido do campo (ajuda o gerador a aplicar numFmt e conversões).',
    enum: ExcelValueFormat,
    example: ExcelValueFormat.TEXT,
  })
  format!: ExcelValueFormat;
}
