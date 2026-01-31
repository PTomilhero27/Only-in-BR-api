import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsIn, IsOptional } from 'class-validator';
import { DocumentTemplateStatus } from '@prisma/client';

/**
 * DTO de listagem com filtros.
 *
 * Responsabilidade:
 * - Controlar filtros e o "modo" de retorno.
 *
 * Observação importante:
 * - mode=summary: NÃO retorna o campo content (mais leve para listagem em cards/tabelas).
 * - mode=full: retorna o template completo (incluindo content).
 *
 * Exemplo:
 * GET /document-templates?status=PUBLISHED&isAddendum=false&mode=summary
 */
export class ListDocumentTemplatesDto {
  @ApiPropertyOptional({
    description: 'Filtra pelo status editorial do template.',
    enum: DocumentTemplateStatus,
    example: 'PUBLISHED',
  })
  @IsEnum(DocumentTemplateStatus)
  @IsOptional()
  status?: DocumentTemplateStatus;

  @ApiPropertyOptional({
    description: 'Filtra se é aditivo (true) ou contrato principal (false).',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  isAddendum?: boolean;

  @ApiPropertyOptional({
    description:
      'Controla o nível de detalhe da resposta. summary não inclui "content" e inclui contagens para UI.',
    example: 'summary',
    enum: ['full', 'summary'],
    default: 'full',
  })
  @IsIn(['full', 'summary'])
  @IsOptional()
  mode?: 'full' | 'summary';
}
