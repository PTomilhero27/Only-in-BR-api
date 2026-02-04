import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsEnum, IsOptional } from 'class-validator'
import { DocumentTemplateStatus } from '@prisma/client'

/**
 * ListDocumentTemplatesDto
 *
 * Responsabilidade:
 * - Definir filtros de listagem para templates globais.
 *
 * Observação importante:
 * - Query params chegam como string (ex.: "false").
 * - Aqui transformamos para boolean para evitar erro de validação.
 */
export class ListDocumentTemplatesDto {
  @ApiPropertyOptional({
    description: 'Filtra por status do template.',
    enum: DocumentTemplateStatus,
    example: 'PUBLISHED',
  })
  @IsOptional()
  @IsEnum(DocumentTemplateStatus)
  status?: DocumentTemplateStatus

  @ApiPropertyOptional({
    description:
      'Filtra por tipo: contrato principal (false) ou aditivo (true). ' +
      'Query string aceita "true"/"false".',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    // ✅ aceita boolean real (caso venha via testes)
    if (typeof value === 'boolean') return value

    // ✅ aceita "true"/"false" (querystring padrão)
    if (value === 'true') return true
    if (value === 'false') return false

    // fallback: deixa como veio para o class-validator apontar erro se for inválido
    return value
  })
  @IsBoolean()
  isAddendum?: boolean

  @ApiPropertyOptional({
    description: 'Modo de retorno: full (com content) ou summary (sem content + usage).',
    enum: ['full', 'summary'],
    example: 'summary',
  })
  @IsOptional()
  @IsEnum(['full', 'summary'] as const)
  mode?: 'full' | 'summary'
}
