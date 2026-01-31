import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { DocumentTemplateStatus } from '@prisma/client';

/**
 * DTO de atualização de template.
 *
 * Responsabilidade:
 * - Atualizar metadados e/ou conteúdo (JSON do editor).
 *
 * Observações:
 * - O front pode enviar "o JSON completo" e editar tudo.
 * - Todos os campos são opcionais para PATCH.
 *
 * Exemplo:
 * PATCH /document-templates/:id
 * {
 *   "title": "Contrato v2",
 *   "status": "PUBLISHED",
 *   "content": { "blocks": [...] }
 * }
 */
export class UpdateDocumentTemplateDto {
  @ApiPropertyOptional({
    description: 'Nome exibido no painel admin.',
    example: 'Contrato de Exposição de Produtos (Atualizado)',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({
    description: 'Indica se este template é um aditivo (por pessoa/OwnerFair).',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  isAddendum?: boolean;

  @ApiPropertyOptional({
    description: 'Se o contrato inclui a ficha cadastral (ANEXO I).',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  hasRegistration?: boolean;

  @ApiPropertyOptional({
    description:
      'Status editorial do template. Use PUBLISHED para disponibilizar, ARCHIVED para desativar em novos usos.',
    enum: DocumentTemplateStatus,
    example: 'PUBLISHED',
  })
  @IsEnum(DocumentTemplateStatus)
  @IsOptional()
  status?: DocumentTemplateStatus;

  @ApiPropertyOptional({
    description: 'Conteúdo principal do template (JSON do editor).',
    example: {
      blocks: [
        { type: 'heading', text: 'CONTRATO (VERSÃO PUBLICADA)' },
        { type: 'paragraph', text: 'Cláusula 1...' },
      ],
    },
  })
  @IsObject()
  @IsOptional()
  content?: Record<string, any>;
}
