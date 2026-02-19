import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Tipos de ID usados no projeto:
 * - UUID: tabelas como Fair
 * - CUID: tabelas como Owner/Stall
 */
export type ExcelScopeParamTypeDto = 'UUID' | 'CUID';

/**
 * ExcelExportRequirementParamDto
 *
 * Descreve 1 parâmetro que o export precisa para montar o contexto.
 * Ex.: fairId obrigatório para relatórios por feira.
 */
export class ExcelExportRequirementParamDto {
  @ApiProperty({
    example: 'fairId',
    description:
      'Chave do parâmetro (deve bater com o CreateExcelExportInputDto).',
  })
  key!: 'fairId' | 'ownerId' | 'stallId';

  @ApiProperty({
    example: 'Feira',
    description: 'Label amigável para UI (autocomplete).',
  })
  label!: string;

  @ApiProperty({
    example: 'UUID',
    description: 'Tipo do ID esperado (UUID ou CUID).',
  })
  type!: ExcelScopeParamTypeDto;

  @ApiProperty({
    example: true,
    description: 'Se este parâmetro é obrigatório para gerar o arquivo.',
  })
  required!: boolean;

  @ApiPropertyOptional({
    example: 'Obrigatório: lista por feira.',
    description: 'Texto auxiliar para UI (ajuda o usuário).',
  })
  hint?: string;

  @ApiPropertyOptional({
    example: ['FAIR_STALLS_LIST', 'FAIR_PURCHASES_LIST'],
    description:
      'Datasets que exigiram este parâmetro (útil para tooltip/explicação no front).',
  })
  requiredByDatasets?: string[];
}
