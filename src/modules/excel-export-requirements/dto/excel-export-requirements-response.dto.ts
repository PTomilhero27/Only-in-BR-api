import { ApiProperty } from '@nestjs/swagger';
import { ExcelExportOptionItemDto } from './excel-export-option-item.dto';
import { ExcelExportRequirementParamDto } from './excel-export-requirement-param.dto';

/**
 * ExcelExportRequirementsResponseDto
 *
 * Resposta do endpoint "requirements":
 * - params: quais campos aparecerão na UI (obrigatórios/opcionais)
 * - options: listas para autocomplete (fairs, owners, stalls)
 *
 * Observação:
 * - options só retorna listas para os params que realmente forem necessários.
 * - Isso deixa o front dinâmico e evita inputs inúteis.
 */
export class ExcelExportRequirementsResponseDto {
  @ApiProperty({
    type: ExcelExportRequirementParamDto,
    isArray: true,
    description: 'Lista de parâmetros necessários para gerar o Excel.',
  })
  params!: ExcelExportRequirementParamDto[];

  @ApiProperty({
    description:
      'Opções para autocompletes, retornadas somente quando necessárias.',
    example: {
      fairId: [{ id: 'uuid', label: 'Feira X', meta: { status: 'ATIVA' } }],
      ownerId: [
        { id: 'cuid', label: 'Maria • 123...', meta: { document: '...' } },
      ],
      stallId: [
        { id: 'cuid', label: 'Pastel do Zé • 3x3', meta: { pdvName: '...' } },
      ],
    },
  })
  options!: Partial<{
    fairId: ExcelExportOptionItemDto[];
    ownerId: ExcelExportOptionItemDto[];
    stallId: ExcelExportOptionItemDto[];
  }>;
}
