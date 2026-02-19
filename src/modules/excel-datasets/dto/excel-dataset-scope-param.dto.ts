import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export type ExcelScopeParamType = 'UUID' | 'CUID';

export class ExcelDatasetScopeParamDto {
  @ApiProperty({
    description: 'Chave do parâmetro de escopo.',
    example: 'fairId',
  })
  @IsString()
  key!: string;

  @ApiProperty({
    description: 'Label amigável para UI.',
    example: 'Feira',
  })
  @IsString()
  label!: string;

  @ApiProperty({
    description: 'Tipo do parâmetro (para validação/placeholder na UI).',
    enum: ['UUID', 'CUID'],
    example: 'UUID',
  })
  @IsIn(['UUID', 'CUID'])
  type!: ExcelScopeParamType;

  @ApiProperty({
    description: 'Se é obrigatório para gerar esse dataset.',
    example: true,
  })
  @IsBoolean()
  required!: boolean;

  @ApiPropertyOptional({
    description:
      'Dica de UX (ex.: “Obrigatório para qualquer exportação por feira”).',
    example: 'Obrigatório para exportar dados desta feira.',
  })
  @IsOptional()
  @IsString()
  hint?: string;
}
